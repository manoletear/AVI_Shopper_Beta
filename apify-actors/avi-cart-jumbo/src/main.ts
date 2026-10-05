import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

interface Input {
  email: string;
  password: string;
  items: Array<{ name: string; quantity: number }>;
}

await Actor.init();
const input = await Actor.getInput<Input>();

if (!input?.email || !input?.password || !input?.items?.length) {
  await Actor.pushData({ success: false, error: 'Missing email, password, or items' });
  await Actor.exit();
}

const crawler = new PlaywrightCrawler({
  headless: true,
  maxRequestsPerCrawl: 1,
  browserPoolOptions: { useFingerprints: true },
  requestHandler: async ({ page }) => {
    const results: Array<{ name: string; added: boolean; price?: number }> = [];

    await page.goto('https://www.jumbo.cl', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Login
    try {
      const loginLink = page.locator('text=Iniciar sesion, text=Ingresar, text=Mi cuenta').first();
      if (await loginLink.isVisible({ timeout: 3000 })) {
        await loginLink.click();
        await page.waitForTimeout(1500);
        await page.fill('input[type="email"], input[name="email"]', input!.email);
        await page.fill('input[type="password"], input[name="password"]', input!.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      }
    } catch {
      console.log('Login skipped');
    }

    // Search and add each product
    for (const item of input!.items) {
      try {
        await page.goto(
          `https://www.jumbo.cl/search?ft=${encodeURIComponent(item.name)}`,
          { waitUntil: 'domcontentloaded' }
        );
        await page.waitForTimeout(2500);

        const addButton = page.locator('button').filter({ hasText: /Agregar|agregar/i }).first();

        if (await addButton.isVisible({ timeout: 5000 })) {
          await addButton.click();
          await page.waitForTimeout(1000);

          let price: number | undefined;
          try {
            const priceEl = await page.locator('[class*="price"], [class*="Price"]').first().textContent();
            if (priceEl) {
              const m = priceEl.replace(/\./g, '').match(/(\d+)/);
              if (m) price = parseInt(m[1]);
            }
          } catch {}

          results.push({ name: item.name, added: true, price });
        } else {
          results.push({ name: item.name, added: false });
        }
      } catch {
        results.push({ name: item.name, added: false });
      }
      await page.waitForTimeout(1000);
    }

    await page.goto('https://www.jumbo.cl/checkout', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const added = results.filter((r) => r.added).length;
    await Actor.pushData({
      success: added > 0,
      cartUrl: page.url(),
      itemsAdded: added,
      itemsFailed: results.filter((r) => !r.added).map((r) => r.name),
      totalEstimated: results.filter((r) => r.price).reduce((s, r) => s + (r.price || 0), 0),
      results,
    });
  },
});

await crawler.run(['https://www.jumbo.cl']);
await Actor.exit();
