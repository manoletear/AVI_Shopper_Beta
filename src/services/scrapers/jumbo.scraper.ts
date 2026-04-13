import { BaseScraper, type ScrapedProduct } from './base.scraper';

// ============================================
// JUMBO SCRAPER (Cencosud - jumbo.cl)
// ============================================

// Categorias de Jumbo mapeadas a sus URLs
const CATEGORY_URLS: Record<string, string> = {
  lacteos: '/lacteos-huevos-y-refrigerados/leches',
  panaderia: '/panaderia-y-pasteleria',
  frutas: '/frutas-y-verduras/frutas',
  verduras: '/frutas-y-verduras/verduras',
  carnes: '/carnes-y-pescados/carnes',
  despensa: '/despensa/arroz-y-pastas',
  bebidas: '/bebidas-y-jugos/bebidas',
  limpieza: '/limpieza-y-hogar/detergentes',
};

export class JumboScraper extends BaseScraper {
  storeName = 'Jumbo';
  private baseUrl = 'https://www.jumbo.cl';

  async scrapeCategory(category: string): Promise<ScrapedProduct[]> {
    if (!this.page) throw new Error('Scraper no inicializado');

    const path = CATEGORY_URLS[category];
    if (!path) throw new Error(`Categoria no mapeada: ${category}`);

    await this.page.goto(`${this.baseUrl}${path}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Esperar a que carguen los productos
    await this.page.waitForSelector('.product-card, [class*="productCard"]', {
      timeout: 15000,
    }).catch(() => null);

    // Extraer productos del DOM
    const products = await this.page.evaluate((cat: string) => {
      const items: Array<{
        name: string;
        brand: string;
        price: number;
        originalPrice?: number;
        inStock: boolean;
        imageUrl?: string;
        sku?: string;
        category: string;
      }> = [];

      // Selectores comunes en sitios Cencosud/VTEX
      const cards = document.querySelectorAll(
        '.product-card, [class*="productCard"], [class*="product-item"]'
      );

      cards.forEach((card) => {
        const nameEl = card.querySelector(
          '.product-card__name, [class*="productName"], [class*="product-name"], h3, h2'
        );
        const priceEl = card.querySelector(
          '.product-card__price, [class*="sellingPrice"], [class*="price-best"], .price'
        );
        const originalPriceEl = card.querySelector(
          '[class*="listPrice"], [class*="price-old"], .original-price, del'
        );
        const brandEl = card.querySelector(
          '.product-card__brand, [class*="brand"]'
        );
        const imgEl = card.querySelector('img');
        const linkEl = card.querySelector('a');

        if (!nameEl || !priceEl) return;

        const priceText = priceEl.textContent || '0';
        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
        if (!price) return;

        let originalPrice: number | undefined;
        if (originalPriceEl) {
          originalPrice = parseInt(
            (originalPriceEl.textContent || '0').replace(/[^0-9]/g, ''),
            10
          ) || undefined;
        }

        // Extraer SKU del href
        let sku: string | undefined;
        if (linkEl) {
          const href = linkEl.getAttribute('href') || '';
          const match = href.match(/\/(\d+)p?$/);
          if (match) sku = match[1];
        }

        items.push({
          name: nameEl.textContent?.trim() || '',
          brand: brandEl?.textContent?.trim() || '',
          price,
          originalPrice,
          inStock: true,
          imageUrl: imgEl?.src || undefined,
          sku,
          category: cat,
        });
      });

      return items;
    }, category);

    return products.map((p) => ({ ...p, unit: undefined }));
  }

  async scrapeSearch(query: string): Promise<ScrapedProduct[]> {
    if (!this.page) throw new Error('Scraper no inicializado');

    await this.page.goto(
      `${this.baseUrl}/search?ft=${encodeURIComponent(query)}`,
      { waitUntil: 'networkidle', timeout: 30000 }
    );

    await this.page.waitForSelector('.product-card, [class*="productCard"]', {
      timeout: 15000,
    }).catch(() => null);

    return this.scrapeCategory('busqueda');
  }
}
