import { PrismaClient } from '@prisma/client';
import { BaseScraper, type ScrapedProduct, type ScrapeResult } from './base.scraper';
import { JumboScraper } from './jumbo.scraper';
import { LiderScraper } from './lider.scraper';

// ============================================
// PRICE SYNC SERVICE
// Orquesta scrapers y alimenta ProductPrice
// ============================================

const prisma = new PrismaClient();

const STORE_SLUGS: Record<string, string> = {
  Jumbo: 'jumbo',
  Líder: 'lider',
};

const CATEGORIES = [
  'lacteos',
  'panaderia',
  'frutas',
  'verduras',
  'carnes',
  'despensa',
  'bebidas',
  'limpieza',
];

interface SyncStats {
  store: string;
  productsFound: number;
  pricesUpserted: number;
  productsCreated: number;
  errors: string[];
  duration: number;
}

/**
 * Busca o crea un producto en la DB basado en nombre y marca
 */
async function findOrCreateProduct(item: ScrapedProduct): Promise<string> {
  // Buscar por nombre similar
  const existing = await prisma.product.findFirst({
    where: {
      name: { contains: item.name.substring(0, 20) },
      brand: item.brand || undefined,
    },
  });

  if (existing) return existing.id;

  // Crear nuevo producto
  const product = await prisma.product.create({
    data: {
      name: item.name,
      brand: item.brand || null,
      category: item.category,
      imageUrl: item.imageUrl || null,
    },
  });

  return product.id;
}

/**
 * Upsert de precio en ProductPrice
 */
async function upsertPrice(
  productId: string,
  storeId: string,
  price: number,
  inStock: boolean
): Promise<void> {
  await prisma.productPrice.upsert({
    where: {
      productId_storeId: { productId, storeId },
    },
    update: {
      price,
      inStock,
      validFrom: new Date(),
      updatedAt: new Date(),
    },
    create: {
      productId,
      storeId,
      price,
      inStock,
      stock: inStock ? 1 : 0,
      validFrom: new Date(),
    },
  });
}

/**
 * Sincroniza los resultados de un scraper con la DB
 */
async function syncResults(result: ScrapeResult): Promise<SyncStats> {
  const start = Date.now();
  const stats: SyncStats = {
    store: result.store,
    productsFound: result.products.length,
    pricesUpserted: 0,
    productsCreated: 0,
    errors: [...result.errors],
    duration: 0,
  };

  // Buscar la tienda en la DB
  const slug = STORE_SLUGS[result.store];
  if (!slug) {
    stats.errors.push(`Store slug no encontrado para: ${result.store}`);
    stats.duration = Date.now() - start;
    return stats;
  }

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) {
    stats.errors.push(`Tienda no encontrada en DB: ${slug}`);
    stats.duration = Date.now() - start;
    return stats;
  }

  for (const item of result.products) {
    try {
      const productId = await findOrCreateProduct(item);
      await upsertPrice(productId, store.id, item.price, item.inStock);
      stats.pricesUpserted++;
    } catch (err) {
      stats.errors.push(`[${item.name}] ${(err as Error).message}`);
    }
  }

  stats.duration = Date.now() - start;
  return stats;
}

/**
 * Ejecuta sync completo de todos los scrapers
 */
export async function runFullSync(
  categories: string[] = CATEGORIES
): Promise<SyncStats[]> {
  const scrapers: BaseScraper[] = [
    new JumboScraper(),
    new LiderScraper(),
  ];

  const allStats: SyncStats[] = [];

  // Ejecutar scrapers en secuencia (para no saturar)
  for (const scraper of scrapers) {
    console.log(`[PriceSync] Iniciando scraping: ${scraper.storeName}`);
    try {
      const result = await scraper.run(categories);
      console.log(
        `[PriceSync] ${scraper.storeName}: ${result.products.length} productos encontrados`
      );

      const stats = await syncResults(result);
      allStats.push(stats);

      console.log(
        `[PriceSync] ${scraper.storeName}: ${stats.pricesUpserted} precios sincronizados en ${stats.duration}ms`
      );
      if (stats.errors.length > 0) {
        console.warn(
          `[PriceSync] ${scraper.storeName}: ${stats.errors.length} errores`
        );
      }
    } catch (err) {
      console.error(`[PriceSync] Error en ${scraper.storeName}:`, err);
      allStats.push({
        store: scraper.storeName,
        productsFound: 0,
        pricesUpserted: 0,
        productsCreated: 0,
        errors: [(err as Error).message],
        duration: 0,
      });
    }

    // Pausa entre tiendas
    await new Promise((r) => setTimeout(r, 5000));
  }

  await prisma.$disconnect();
  return allStats;
}

/**
 * Busca precios de un producto especifico en todas las tiendas
 */
export async function scrapeProductPrice(
  query: string
): Promise<ScrapeResult[]> {
  const scrapers: BaseScraper[] = [
    new JumboScraper(),
    new LiderScraper(),
  ];

  const results: ScrapeResult[] = [];

  for (const scraper of scrapers) {
    try {
      await scraper.init();
      const products = await scraper.scrapeSearch(query);
      results.push({
        store: scraper.storeName,
        products,
        scrapedAt: new Date().toISOString(),
        errors: [],
      });
      await scraper.close();
    } catch (err) {
      results.push({
        store: scraper.storeName,
        products: [],
        scrapedAt: new Date().toISOString(),
        errors: [(err as Error).message],
      });
    }
  }

  return results;
}
