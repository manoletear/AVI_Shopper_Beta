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
  await Actor.pushData({ success: false, error: 'Missing input' });
  await Actor.exit();
}

const crawler = new PlaywrightCrawler({
  headless: true,
  maxRequestsPerCrawl: 1,
  browserPoolOptions: { useFingerprints: true },
  requestHandler: async ({ page }) => {
    const results: Array<{ name: string; added: boolean; price?: number }> = [];

    await page.goto('https://www.unimarc.cl', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Login
    try {
      const loginBtn = page.locator('text=Ingresar, text=Iniciar').first();
      if (await loginBtn.isVisible({ timeout: 3000 })) {
        await loginBtn.click();
        await page.waitForTimeout(1500);
        await page.fill('input[type="email"], input[name="email"]', input!.email);
        await page.fill('input[type="password"], input[name="password"]', input!.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      }
    } catch { console.log('Login skipped'); }

    for (const item of input!.items) {
      try {
        await page.goto(
          `https://www.unimarc.cl/category?search=${encodeURIComponent(item.name)}`,
          { waitUntil: 'domcontentloaded' }
        );
        await page.waitForTimeout(2500);

        const addBtn = page.locator('button').filter({ hasText: /Agregar|agregar|Add/i }).first();
        if (await addBtn.isVisible({ timeout: 5000 })) {
          await addBtn.click();
          await page.waitForTimeout(1000);
          results.push({ name: item.name, added: true });
        } else {
          results.push({ name: item.name, added: false });
        }
      } catch {
        results.push({ name: item.name, added: false });
      }
      await page.waitForTimeout(1000);
    }

    await page.goto('https://www.unimarc.cl/checkout', { waitUntil: 'domcontentloaded' });
    const added = results.filter((r) => r.added).length;
    await Actor.pushData({
      success: added > 0, cartUrl: page.url(),
      itemsAdded: added, itemsFailed: results.filter((r) => !r.added).map((r) => r.name),
      results,
    });
  },
});

await crawler.run(['https://www.unimarc.cl']);
await Actor.exit();
