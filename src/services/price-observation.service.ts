/**
 * Price Observation Service
 *
 * Guarda cada precio scrapeado con timestamp.
 * Permite consultar precios historicos, tendencias,
 * y mostrar "precio de hace X horas" en la UI.
 *
 * Flujo:
 * 1. comparePrices() busca en Apify
 * 2. savePriceObservations() guarda cada resultado con timestamp
 * 3. getLatestPrices() retorna precios mas recientes sin re-scrapear
 * 4. getPriceHistory() retorna tendencia de un producto
 */

import { prisma } from '@/lib/prisma';

interface ObservedPrice {
  productName: string;
  brand?: string;
  storeSlug: string;
  storeName: string;
  price: number;
  listPrice?: number;
  inStock: boolean;
  url?: string;
  imageUrl?: string;
  searchTerm: string;
}

/**
 * Guarda multiples precios observados en una transaccion
 */
export async function savePriceObservations(
  prices: ObservedPrice[]
): Promise<number> {
  if (prices.length === 0) return 0;

  const now = new Date();

  const data = prices.map((p) => ({
    productName: p.productName,
    brand: p.brand || null,
    storeSlug: p.storeSlug,
    storeName: p.storeName,
    price: p.price,
    listPrice: p.listPrice || null,
    inStock: p.inStock,
    url: p.url || null,
    imageUrl: p.imageUrl || null,
    searchTerm: p.searchTerm,
    observedAt: now,
  }));

  const result = await prisma.priceObservation.createMany({ data });
  return result.count;
}

/**
 * Obtiene los precios mas recientes para un producto
 * sin necesidad de re-scrapear (cache de precios)
 */
export async function getLatestPrices(
  searchTerm: string,
  maxAgeHours = 12
): Promise<Array<{
  productName: string;
  brand: string | null;
  storeSlug: string;
  storeName: string;
  price: number;
  listPrice: number | null;
  inStock: boolean;
  observedAt: Date;
  hoursAgo: number;
}>> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - maxAgeHours);

  const observations = await prisma.priceObservation.findMany({
    where: {
      searchTerm: { equals: searchTerm },
      observedAt: { gte: cutoff },
    },
    orderBy: { observedAt: 'desc' },
  });

  // Deduplicar: solo el mas reciente por producto+tienda
  const seen = new Set<string>();
  const latest = [];

  for (const obs of observations) {
    const key = `${obs.productName.toLowerCase()}|${obs.storeSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const hoursAgo = Math.round(
      (Date.now() - obs.observedAt.getTime()) / (1000 * 60 * 60)
    );

    latest.push({
      productName: obs.productName,
      brand: obs.brand,
      storeSlug: obs.storeSlug,
      storeName: obs.storeName,
      price: obs.price,
      listPrice: obs.listPrice,
      inStock: obs.inStock,
      observedAt: obs.observedAt,
      hoursAgo,
    });
  }

  return latest;
}

/**
 * Obtiene historico de precios de un producto en una tienda
 * para mostrar tendencias (subio/bajo)
 */
export async function getPriceHistory(
  productName: string,
  storeSlug: string,
  days = 30
): Promise<Array<{
  price: number;
  observedAt: Date;
}>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return prisma.priceObservation.findMany({
    where: {
      productName: { contains: productName },
      storeSlug,
      observedAt: { gte: cutoff },
    },
    select: { price: true, observedAt: true },
    orderBy: { observedAt: 'asc' },
  });
}

/**
 * Calcula la tendencia de precio (subio, bajo, estable)
 */
export async function getPriceTrend(
  productName: string,
  storeSlug: string
): Promise<{
  trend: 'up' | 'down' | 'stable' | 'unknown';
  currentPrice: number | null;
  previousPrice: number | null;
  changePercent: number;
}> {
  const history = await getPriceHistory(productName, storeSlug, 14);

  if (history.length < 2) {
    return { trend: 'unknown', currentPrice: history[0]?.price || null, previousPrice: null, changePercent: 0 };
  }

  const current = history[history.length - 1].price;
  const previous = history[0].price;
  const change = ((current - previous) / previous) * 100;

  let trend: 'up' | 'down' | 'stable';
  if (change > 3) trend = 'up';
  else if (change < -3) trend = 'down';
  else trend = 'stable';

  return { trend, currentPrice: current, previousPrice: previous, changePercent: Number(change.toFixed(1)) };
}

/**
 * Estadisticas de precios observados
 */
export async function getPriceStats(): Promise<{
  totalObservations: number;
  uniqueProducts: number;
  stores: string[];
  oldestObservation: Date | null;
  newestObservation: Date | null;
}> {
  const [total, oldest, newest] = await Promise.all([
    prisma.priceObservation.count(),
    prisma.priceObservation.findFirst({ orderBy: { observedAt: 'asc' }, select: { observedAt: true } }),
    prisma.priceObservation.findFirst({ orderBy: { observedAt: 'desc' }, select: { observedAt: true } }),
  ]);

  const stores = await prisma.priceObservation.findMany({
    select: { storeSlug: true },
    distinct: ['storeSlug'],
  });

  return {
    totalObservations: total,
    uniqueProducts: 0,
    stores: stores.map((s) => s.storeSlug),
    oldestObservation: oldest?.observedAt || null,
    newestObservation: newest?.observedAt || null,
  };
}
