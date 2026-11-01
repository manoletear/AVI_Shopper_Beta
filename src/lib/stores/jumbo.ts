import type { Browser, BrowserContext, Page } from 'playwright';
import {
  BLOCKER_SELECTORS,
  FORBIDDEN_BUTTON_TEXT,
  isForbiddenCheckoutUrl,
  looksLikeBlockerTitle,
  parseClp,
} from './guards';
import {
  NeedsUserActionError,
  type AddToCartResult,
  type AddressInput,
  type CartItemInput,
  type DeliveryWindow,
  type LoginInput,
  type SearchProductInput,
  type SessionResult,
  type StoreAdapter,
  type StoreCart,
  type StoreProduct,
} from './types';

/**
 * Adaptador Jumbo con Playwright headless. SOLO corre en el worker de tiendas
 * (Node con Chromium), nunca en una función serverless de Vercel.
 *
 * Los selectores son de mejor esfuerzo y deben validarse contra jumbo.cl en vivo.
 * No se falsifica el user agent ni se evaden captchas: si aparecen, needs_user_action.
 * Nunca se hace checkout: las rutas de pago se abortan a nivel de red.
 */

const BASE = 'https://www.jumbo.cl';
const TIMEOUT = 30_000;

interface JsonLdProduct {
  sku: string | null;
  name: string;
  brand: string | null;
  price: number;
  available: boolean;
}

export class JumboAdapter implements StoreAdapter {
  readonly slug = 'jumbo' as const;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private async ensurePage(): Promise<Page> {
    if (this.page) return this.page;
    // Import dinámico: el bundle de Next nunca incluye Playwright.
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({ locale: 'es-CL', viewport: { width: 1280, height: 800 } });
    await this.context.route('**/*', (route) =>
      isForbiddenCheckoutUrl(route.request().url()) ? route.abort('blockedbyclient') : route.continue(),
    );
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(TIMEOUT);
    return this.page;
  }

  private async blocked(page: Page): Promise<boolean> {
    if (looksLikeBlockerTitle(await page.title())) return true;
    for (const selector of BLOCKER_SELECTORS) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) return true;
    }
    return false;
  }

  private async goto(url: string): Promise<Page> {
    const page = await this.ensurePage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    if (await this.blocked(page)) {
      throw new NeedsUserActionError('Jumbo pide una verificación (captcha o código). La familia debe completarla.');
    }
    return page;
  }

  private async isLoggedIn(page: Page): Promise<boolean> {
    return page
      .locator('[href*="/mi-cuenta"], [data-testid="user-menu"], .vtex-login-2-x-profile')
      .first()
      .isVisible()
      .catch(() => false);
  }

  private async cookies(): Promise<string> {
    const all = await this.context!.cookies();
    return JSON.stringify(all.filter((c) => c.domain.endsWith('jumbo.cl')));
  }

  private async wrap(fn: () => Promise<SessionResult>): Promise<SessionResult> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof NeedsUserActionError) return { status: 'needs_user_action', message: error.message };
      return { status: 'error', message: 'No pude conectar con Jumbo' };
    }
  }

  async login(credentials: LoginInput): Promise<SessionResult> {
    return this.wrap(async () => {
      const page = await this.goto(`${BASE}/login`);
      await page.fill('input[type="email"], input[name="email"]', credentials.email);
      await page.fill('input[type="password"], input[name="password"]', credentials.password);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      if (await this.blocked(page)) {
        return { status: 'needs_user_action', message: 'Jumbo pide verificación adicional (captcha o 2FA).' };
      }
      if (!(await this.isLoggedIn(page))) return { status: 'error', message: 'Jumbo no aceptó el inicio de sesión' };
      return { status: 'ok', sessionCookies: await this.cookies() };
    });
  }

  async restoreSession(sessionCookies: string): Promise<SessionResult> {
    return this.wrap(async () => {
      await this.ensurePage();
      await this.context!.addCookies(JSON.parse(sessionCookies));
      const page = await this.goto(BASE);
      if (!(await this.isLoggedIn(page))) return { status: 'expired', message: 'La sesión de Jumbo expiró' };
      return { status: 'ok', sessionCookies: await this.cookies() };
    });
  }

  /** Lee el JSON-LD Product de una ficha (sku, nombre, precio, stock). */
  private async readProductPage(page: Page): Promise<JsonLdProduct | null> {
    return page.evaluate(() => {
      for (const node of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
        try {
          const raw = JSON.parse(node.textContent || 'null');
          const list = Array.isArray(raw) ? raw : raw?.['@graph'] ?? [raw];
          const product = list.find((x: { '@type'?: string }) => x && x['@type'] === 'Product');
          if (!product) continue;
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers?.offers?.[0] ?? product.offers;
          return {
            sku: product.sku ? String(product.sku) : null,
            name: String(product.name || ''),
            brand: typeof product.brand === 'string' ? product.brand : product.brand?.name ?? null,
            price: Math.round(Number(offer?.price ?? offer?.lowPrice ?? 0)),
            available: /InStock/i.test(String(offer?.availability ?? '')),
          };
        } catch {
          /* siguiente bloque */
        }
      }
      return null;
    });
  }

  async searchProduct(input: SearchProductInput): Promise<StoreProduct[]> {
    const query = input.ean || input.sku || input.query || '';
    const page = await this.goto(`${BASE}/busqueda?ft=${encodeURIComponent(query)}`);
    const links = await page.$$eval('a[href$="/p"]', (els) =>
      Array.from(new Set(els.map((el) => (el as HTMLAnchorElement).href))).slice(0, 5),
    );
    const products: StoreProduct[] = [];
    for (const url of links) {
      await this.goto(url);
      const data = await this.readProductPage(page);
      if (data?.name) products.push({ ...data, url });
    }
    return products;
  }

  async addToCart(items: CartItemInput[]): Promise<AddToCartResult> {
    const result: AddToCartResult = { added: [], failed: [] };
    for (const item of items) {
      try {
        if (!item.productUrl) {
          result.failed.push({ name: item.name, reason: 'not_found' });
          continue;
        }
        const page = await this.goto(item.productUrl);
        const data = await this.readProductPage(page);
        if (data && !data.available) {
          result.failed.push({ name: item.name, reason: 'out_of_stock' });
          continue;
        }
        const add = page.getByRole('button', { name: /^agregar/i }).first();
        if (!(await add.isVisible().catch(() => false))) {
          result.failed.push({ name: item.name, reason: 'out_of_stock' });
          continue;
        }
        const label = (await add.textContent()) || '';
        if (FORBIDDEN_BUTTON_TEXT.test(label)) throw new Error('Botón de pago detectado');
        await add.click();
        // Tras el primer clic aparece el selector de cantidad: "+" suma de a uno.
        const plus = page.getByRole('button', { name: /^(\+|aumentar|sumar)/i }).first();
        for (let q = 1; q < item.quantity; q++) {
          await plus.click();
          await page.waitForTimeout(400);
        }
        result.added.push({ name: item.name, quantity: item.quantity });
      } catch (error) {
        result.failed.push({
          name: item.name,
          reason: error instanceof NeedsUserActionError ? 'needs_user_action' : 'error',
        });
        if (error instanceof NeedsUserActionError) break;
      }
    }
    return result;
  }

  /** Solo lee el carro (paso "cart"). No avanza a envío ni pago. */
  async getCart(): Promise<StoreCart> {
    const page = await this.goto(`${BASE}/checkout/#/cart`);
    const rows = await page.$$eval('tr.product-item, [data-testid="cart-item"]', (els) =>
      els.map((el) => ({
        sku: el.getAttribute('data-sku'),
        name: el.querySelector('.product-name a, .product-name, [data-testid="item-name"]')?.textContent?.trim() || '',
        quantity: Number((el.querySelector('input.quantity-input, input[type="tel"], input[type="number"]') as HTMLInputElement | null)?.value || '0'),
        total: el.querySelector('.total-selling-price, .item-total, [data-testid="item-total"]')?.textContent || '',
      })),
    );
    const items = rows
      .filter((row) => row.name)
      .map((row) => {
        const totalPrice = parseClp(row.total);
        return {
          sku: row.sku,
          name: row.name,
          quantity: row.quantity,
          unitPrice: row.quantity > 0 ? Math.round(totalPrice / row.quantity) : 0,
          totalPrice,
        };
      });
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return { items, subtotal, total: subtotal };
  }

  /**
   * Ventanas de despacho. Jumbo solo las muestra con sesión y dirección.
   * Lee el paso de envío sin confirmar nada; nunca entra a #/payment.
   */
  async getDeliveryWindows(address: AddressInput): Promise<DeliveryWindow[]> {
    const page = await this.goto(`${BASE}/checkout/#/shipping`);
    const input = page.locator('input[name="address"], #ship-street, #ship-addressQuery').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill([address.street, address.number, address.comuna].filter(Boolean).join(' '));
      await page.waitForTimeout(1500);
    }
    const slots = await page.$$eval('.delivery-window, [data-testid="delivery-slot"], .scheduled-delivery-choice', (els) =>
      els.slice(0, 30).map((el, i) => ({
        id: el.getAttribute('data-id') || `slot-${i}`,
        date: el.querySelector('.date, [data-testid="slot-date"]')?.textContent?.trim() || '',
        timeRange: el.querySelector('.time, [data-testid="slot-time"]')?.textContent?.trim() || el.textContent?.trim() || '',
        price: el.querySelector('.price, [data-testid="slot-price"]')?.textContent || '',
        available: !el.classList.contains('disabled') && el.getAttribute('aria-disabled') !== 'true',
      })),
    );
    return slots.map((slot) => ({ ...slot, price: parseClp(slot.price) }));
  }

  async clearCart(): Promise<void> {
    const page = await this.goto(`${BASE}/checkout/#/cart`);
    const remove = page.locator('.item-link-remove, [data-testid="remove-item"]');
    for (let guard = 0; guard < 100 && (await remove.count()) > 0; guard++) {
      await remove.first().click();
      await page.waitForTimeout(400);
    }
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
    this.context = null;
    this.page = null;
  }
}
