/**
 * Apify Price Service
 *
 * Obtiene precios reales de supermercados chilenos via Apify actors:
 * - scraperschile/jumbo (Jumbo)
 * - scraperschile/lider-cl (Lider)
 * - automation-lab/chile-supermarket-price-comparison (Jumbo + Santa Isabel)
 */

import { searchSuperLider } from './super-lider.service';

const APIFY_BASE = 'https://api.apify.com/v2';

interface ApifyProduct {
  name: string;
  brand: string;
  price: number;
  listPrice?: number;
  inStock: boolean;
  store: string;
  url?: string;
  imageUrl?: string;
  categories?: string;
}

interface PriceComparison {
  query: string;
  results: ApifyProduct[];
  cheapest: ApifyProduct | null;
  scrapedAt: string;
}

async function callApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  apiToken: string,
  timeoutSecs = 30
): Promise<any[]> {
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?waitForFinish=${timeoutSecs}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(input),
    }
  );

  if (!runRes.ok) {
    throw new Error(`Apify run failed: ${runRes.status} ${runRes.statusText}`);
  }

  const run = await runRes.json();
  const datasetId = run.data?.defaultDatasetId;
  if (!datasetId) throw new Error('No dataset returned');

  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?clean=true&limit=50`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );

  if (!itemsRes.ok) throw new Error('Failed to fetch dataset items');
  return itemsRes.json();
}

export async function searchJumbo(
  query: string,
  apiToken: string,
  maxPages = 1
): Promise<ApifyProduct[]> {
  const items = await callApifyActor(
    'scraperschile~jumbo',
    { term: query, maxPages, pageSize: 20 },
    apiToken
  );

  return items.map((item: any) => ({
    name: item.name,
    brand: item.brand || '',
    price: item.price,
    listPrice: item.list_price,
    inStock: item.stock !== false,
    store: 'Jumbo',
    url: item.url,
    imageUrl: item.image,
    categories: item.categories,
  }));
}

export async function searchLider(
  query: string,
  apiToken: string,
): Promise<ApifyProduct[]> {
  const result = await searchSuperLider(query, apiToken);

  return result.products.map((item) => ({
    name: item.name,
    brand: item.brand || '',
    price: item.price,
    listPrice: item.originalPrice,
    inStock: item.inStock,
    store: 'Lider' as const,
    url: item.url,
    imageUrl: item.imageUrl,
  }));
}

export async function comparePrices(
  query: string,
  apiToken: string
): Promise<PriceComparison> {
  const [jumboResults, liderResults] = await Promise.all([
    searchJumbo(query, apiToken).catch(() => [] as ApifyProduct[]),
    searchLider(query, apiToken).catch(() => [] as ApifyProduct[]),
  ]);

  const allResults = [...jumboResults, ...liderResults].filter(
    (p) => p.inStock && p.price > 0
  );

  const cheapest = allResults.length > 0
    ? allResults.reduce((min, p) => (p.price < min.price ? p : min))
    : null;

  return {
    query,
    results: allResults,
    cheapest,
    scrapedAt: new Date().toISOString(),
  };
}

export async function compareProductList(
  products: string[],
  apiToken: string
): Promise<Map<string, PriceComparison>> {
  const comparisons = new Map<string, PriceComparison>();

  // Ejecutar en secuencia para no saturar Apify
  for (const product of products) {
    const comparison = await comparePrices(product, apiToken);
    comparisons.set(product, comparison);
    // Pausa entre requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  return comparisons;
}
