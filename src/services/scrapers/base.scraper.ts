import { chromium, type Browser, type Page } from 'playwright';

// ============================================
// TIPOS
// ============================================

export interface ScrapedProduct {
  name: string;
  brand: string;
  price: number;         // en CLP (entero)
  originalPrice?: number; // precio sin descuento
  inStock: boolean;
  category: string;
  imageUrl?: string;
  sku?: string;
  unit?: string;         // "1L", "1kg", etc.
}

export interface ScrapeResult {
  store: string;
  products: ScrapedProduct[];
  scrapedAt: string;
  errors: string[];
}

// ============================================
// BASE SCRAPER
// ============================================

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  abstract storeName: string;

  async init(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'es-CL',
    });
    this.page = await context.newPage();
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }

  abstract scrapeCategory(category: string): Promise<ScrapedProduct[]>;
  abstract scrapeSearch(query: string): Promise<ScrapedProduct[]>;

  async run(categories: string[]): Promise<ScrapeResult> {
    const products: ScrapedProduct[] = [];
    const errors: string[] = [];

    try {
      await this.init();

      for (const category of categories) {
        try {
          const items = await this.scrapeCategory(category);
          products.push(...items);
          // Pausa entre categorias para no saturar
          await this.delay(2000 + Math.random() * 3000);
        } catch (err) {
          errors.push(`[${category}] ${(err as Error).message}`);
        }
      }
    } finally {
      await this.close();
    }

    return {
      store: this.storeName,
      products,
      scrapedAt: new Date().toISOString(),
      errors,
    };
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  protected parsePrice(text: string): number {
    // "$1.250" → 1250, "$ 1.250" → 1250
    const cleaned = text.replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
  }
}
