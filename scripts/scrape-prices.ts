const { chromium } = require('playwright');

interface ScrapedProduct {
  name: string;
  price: number;
  originalPrice?: number;
  store: string;
}

async function scrapeJumbo(query: string): Promise<{ products: ScrapedProduct[]; errors: string[] }> {
  const products: ScrapedProduct[] = [];
  const errors: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  let plpData: any = null;
  page.on('response', async (resp: any) => {
    if (resp.url().includes('bff.jumbo.cl/catalog/plp') && resp.status() === 200) {
      try { plpData = await resp.json(); } catch {}
    }
  });

  try {
    await page.goto(`https://www.jumbo.cl/buscar?ft=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    // Esperar que el contenido JS renderice
    await page.waitForTimeout(10000);
    // Scroll para trigger lazy load
    for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 600)); await page.waitForTimeout(800); }
    await page.waitForTimeout(3000);

    // Debug: log cuantos elementos hay
    const debug = await page.evaluate(() => ({
      allLinks: document.querySelectorAll('a').length,
      priceTexts: Array.from(document.querySelectorAll('*')).filter(el => el.textContent?.match(/^\$[\d.]+$/) && el.children.length === 0).length,
      bodyLength: document.body.innerText.length,
    }));
    console.log('  [debug] links:', debug.allLinks, 'prices:', debug.priceTexts, 'bodyLen:', debug.bodyLength);

    if (plpData?.products) {
      for (const p of plpData.products) {
        products.push({
          name: p.displayName || p.name || '',
          price: p.prices?.offerPrice || p.prices?.normalPrice || 0,
          originalPrice: p.prices?.normalPrice,
          store: 'Jumbo',
        });
      }
    }
    // Fallback: extraer del DOM
    if (products.length === 0) {
      const domProducts = await page.evaluate(() => {
        const results: any[] = [];
        // Buscar todos los textos que parezcan precios y sus nombres cercanos
        const allEls = document.querySelectorAll('*');
        const priceEls: any[] = [];
        allEls.forEach(el => {
          const t = el.textContent?.trim() || '';
          if (t.match(/^\$[\d.]+$/) && el.children.length === 0) {
            priceEls.push({ el, price: parseInt(t.replace(/[^0-9]/g, '')) });
          }
        });
        // Para cada precio, buscar el nombre mas cercano
        priceEls.forEach(({ el, price }) => {
          let parent = el.parentElement;
          for (let i = 0; i < 6 && parent; i++) {
            const nameEl = parent.querySelector('h3, h2, [class*=name], [class*=Name], a[href*="/p"]');
            if (nameEl) {
              const name = nameEl.textContent?.trim();
              if (name && name.length > 3 && name.length < 200 && price > 100) {
                results.push({ name, price });
                break;
              }
            }
            parent = parent.parentElement;
          }
        });
        // Deduplicate
        const seen = new Set();
        return results.filter(r => { if (seen.has(r.name)) return false; seen.add(r.name); return true; }).slice(0, 20);
      });
      domProducts.forEach((p: any) => products.push({ ...p, store: 'Jumbo' }));
      if (domProducts.length === 0) errors.push('No se encontraron productos via BFF ni DOM');
    }
  } catch (e: any) {
    errors.push(e.message);
  }

  await browser.close();
  return { products, errors };
}

async function scrapeLider(query: string): Promise<{ products: ScrapedProduct[]; errors: string[] }> {
  const products: ScrapedProduct[] = [];
  const errors: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  try {
    await page.goto(`https://www.lider.cl/supermercado/search?Ntt=${encodeURIComponent(query)}`, {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });

    if (page.url().includes('blocked')) {
      errors.push('Bloqueado por anti-bot');
      await browser.close();
      return { products, errors };
    }

    await page.waitForTimeout(5000);
    for (let i = 0; i < 3; i++) { await page.evaluate(() => window.scrollBy(0, 500)); await page.waitForTimeout(500); }
    await page.waitForTimeout(2000);

    const items = await page.evaluate(() => {
      const results: any[] = [];
      document.querySelectorAll('[class*=product], [class*=Product], article').forEach(card => {
        const name = card.querySelector('h3, [class*=name], [class*=Name], [class*=title]')?.textContent?.trim();
        const priceText = card.querySelector('[class*=price], [class*=Price]')?.textContent?.replace(/[^0-9]/g, '') || '0';
        const price = parseInt(priceText);
        if (name && price > 100) results.push({ name, price });
      });
      return results.slice(0, 20);
    });

    items.forEach((p: any) => products.push({ ...p, store: 'Lider' }));
    if (items.length === 0) errors.push('No se encontraron productos en el DOM');
  } catch (e: any) {
    errors.push(e.message);
  }

  await browser.close();
  return { products, errors };
}

async function main() {
  const query = process.argv[2] || 'leche';
  console.log(`\nBuscando "${query}" en supermercados reales...\n`);

  const [jumbo, lider] = await Promise.all([scrapeJumbo(query), scrapeLider(query)]);

  for (const [name, result] of [['JUMBO', jumbo], ['LIDER', lider]] as const) {
    console.log(`=== ${name} (${result.products.length} productos) ===`);
    if (result.errors.length) console.log(`  ⚠ ${result.errors.join(', ')}`);
    result.products.forEach(p => {
      const orig = p.originalPrice && p.originalPrice !== p.price ? ` (antes $${p.originalPrice.toLocaleString('es-CL')})` : '';
      console.log(`  $${p.price.toLocaleString('es-CL')} — ${p.name}${orig}`);
    });
    console.log('');
  }
}

main();
