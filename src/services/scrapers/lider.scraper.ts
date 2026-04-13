import { BaseScraper, type ScrapedProduct } from './base.scraper';

// ============================================
// LIDER SCRAPER (Walmart Chile - lider.cl)
// ============================================

const CATEGORY_URLS: Record<string, string> = {
  lacteos: '/supermercado/category/Lacteos/Leches/_/N-1cbn0pi',
  panaderia: '/supermercado/category/Panaderia/_/N-1cbn0p8',
  frutas: '/supermercado/category/Frutas-y-Verduras/Frutas/_/N-xt8gg1',
  verduras: '/supermercado/category/Frutas-y-Verduras/Verduras/_/N-1v2she8',
  carnes: '/supermercado/category/Carnes/_/N-1cbn0p6',
  despensa: '/supermercado/category/Despensa/_/N-1cbn0p9',
  bebidas: '/supermercado/category/Bebidas/_/N-1cbn0pa',
  limpieza: '/supermercado/category/Limpieza/_/N-1cbn0p4',
};

export class LiderScraper extends BaseScraper {
  storeName = 'Líder';
  private baseUrl = 'https://www.lider.cl';

  async scrapeCategory(category: string): Promise<ScrapedProduct[]> {
    if (!this.page) throw new Error('Scraper no inicializado');

    const path = CATEGORY_URLS[category];
    if (!path) throw new Error(`Categoria no mapeada: ${category}`);

    await this.page.goto(`${this.baseUrl}${path}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Lider carga productos via JS, esperar render
    await this.page.waitForSelector(
      '[class*="product"], [class*="Product"], .product-card',
      { timeout: 15000 }
    ).catch(() => null);

    // Scroll para cargar lazy-loaded items
    await this.autoScroll();

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

      const cards = document.querySelectorAll(
        '[class*="product-card"], [class*="ProductCard"], [class*="product-item"]'
      );

      cards.forEach((card) => {
        const nameEl = card.querySelector(
          '[class*="product-card__name"], [class*="ProductName"], [class*="product-name"], h3'
        );
        const priceEl = card.querySelector(
          '[class*="product-card__price"], [class*="Price"], [class*="price"] span'
        );
        const brandEl = card.querySelector('[class*="brand"], [class*="Brand"]');
        const imgEl = card.querySelector('img');
        const outOfStock = card.querySelector('[class*="outOfStock"], [class*="sin-stock"]');

        if (!nameEl || !priceEl) return;

        const priceText = priceEl.textContent || '0';
        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
        if (!price) return;

        items.push({
          name: nameEl.textContent?.trim() || '',
          brand: brandEl?.textContent?.trim() || '',
          price,
          inStock: !outOfStock,
          imageUrl: imgEl?.src || undefined,
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
      `${this.baseUrl}/supermercado/search?Ntt=${encodeURIComponent(query)}`,
      { waitUntil: 'networkidle', timeout: 30000 }
    );

    return this.scrapeCategory('busqueda');
  }

  private async autoScroll(): Promise<void> {
    if (!this.page) return;
    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight || totalHeight > 5000) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });
    await new Promise((r) => setTimeout(r, 1000));
  }
}
