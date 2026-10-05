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
  browserPoolOptions: {
    useFingerprints: true,
  },
  requestHandler: async ({ page }) => {
    const results: Array<{ name: string; added: boolean; price?: number }> = [];

    // 1. Go to Lider Super
    await page.goto('https://super.lider.cl', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 2. Try to login
    try {
      const loginBtn = page.locator('text=Ingresar').first();
      if (await loginBtn.isVisible({ timeout: 3000 })) {
        await loginBtn.click();
        await page.waitForTimeout(1000);

        await page.fill('input[type="email"], input[name="email"]', input!.email);
        await page.fill('input[type="password"], input[name="password"]', input!.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      }
    } catch {
      console.log('Login skipped or failed, continuing as guest');
    }

    // 3. Search and add each product
    for (const item of input!.items) {
      try {
        await page.goto(
          `https://super.lider.cl/search?q=${encodeURIComponent(item.name)}`,
          { waitUntil: 'domcontentloaded' }
        );
        await page.waitForTimeout(2000);

        // Handle CAPTCHA if present
        const captcha = page.locator('text=Robot o humano');
        if (await captcha.isVisible({ timeout: 2000 })) {
          console.log('CAPTCHA detected, waiting...');
          await page.waitForTimeout(5000);
        }

        // Find first product card and add button
        const addButton = page.locator('button').filter({ hasText: /Agregar|agregar|Add/i }).first();

        if (await addButton.isVisible({ timeout: 5000 })) {
          await addButton.click();
          await page.waitForTimeout(1000);

          // Try to get price
          let price: number | undefined;
          try {
            const priceText = await page.locator('[class*="price"], [data-testid*="price"]').first().textContent();
            if (priceText) {
              const match = priceText.replace(/\./g, '').match(/(\d+)/);
              if (match) price = parseInt(match[1]);
            }
          } catch {}

          results.push({ name: item.name, added: true, price });

          // Handle quantity > 1
          if (item.quantity > 1) {
            for (let q = 1; q < item.quantity; q++) {
              try {
                const plusBtn = page.locator('button[aria-label*="increment"], button:has-text("+")').first();
                if (await plusBtn.isVisible({ timeout: 2000 })) {
                  await plusBtn.click();
                  await page.waitForTimeout(500);
                }
              } catch {}
            }
          }
        } else {
          results.push({ name: item.name, added: false });
        }
      } catch (error) {
        results.push({ name: item.name, added: false });
      }

      await page.waitForTimeout(1000);
    }

    // 4. Go to cart and get URL
    await page.goto('https://super.lider.cl/cart', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const cartUrl = page.url();

    const added = results.filter((r) => r.added).length;
    const total = results.filter((r) => r.price).reduce((s, r) => s + (r.price || 0), 0);

    await Actor.pushData({
      success: added > 0,
      cartUrl,
      itemsAdded: added,
      itemsFailed: results.filter((r) => !r.added).map((r) => r.name),
      totalEstimated: total,
      results,
    });
  },
});

await crawler.run(['https://super.lider.cl']);
await Actor.exit();
