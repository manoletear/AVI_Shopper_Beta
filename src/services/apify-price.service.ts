/**
 * Apify Price Service
 *
 * Obtiene precios reales de supermercados chilenos via Apify actors:
 * - scraperschile/jumbo (Jumbo)
 * - scraperschile/unimarc (Unimarc)
 * - scraperschile/tottus (Tottus)
 * - super.lider.cl via RAG Web Browser (Lider Supermercado)
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
    url: `https://super.lider.cl/search?q=${encodeURIComponent(item.name)}`,
    imageUrl: item.imageUrl,
  }));
}

export async function searchTottus(
  query: string,
  apiToken: string,
  maxPages = 1
): Promise<ApifyProduct[]> {
  const items = await callApifyActor(
    'scraperschile~tottus',
    { term: query, maxPages, pageSize: 20 },
    apiToken
  );

  return items.map((item: any) => ({
    name: item.name,
    brand: item.brand || '',
    price: item.price,
    listPrice: item.list_price,
    inStock: (item.available_quantity ?? 1) > 0,
    store: 'Tottus',
    url: item.url,
    imageUrl: item.image,
    categories: item.categories,
  }));
}

export async function searchUnimarc(
  query: string,
  apiToken: string,
  maxPages = 1
): Promise<ApifyProduct[]> {
  const items = await callApifyActor(
    'scraperschile~unimarc',
    { term: query, maxPages, pageSize: 20 },
    apiToken
  );

  return items.map((item: any) => ({
    name: item.name,
    brand: item.brand || '',
    price: item.price,
    listPrice: item.list_price,
    inStock: (item.available_quantity ?? 1) > 0,
    store: 'Unimarc',
    url: item.url,
    imageUrl: item.image,
    categories: item.categories,
  }));
}

/**
 * Calcula la relevancia de un producto respecto a la busqueda.
 * Retorna un score de 0 a 1.
 *
 * Logica:
 * - Extrae palabras clave de la busqueda (>2 chars)
 * - Cuenta cuantas aparecen en el nombre del producto
 * - Score = palabras encontradas / total palabras clave
 * - Bonus si el nombre empieza con la primera palabra clave
 */
const NON_GROCERY_KEYWORDS = /antitranspirante|desodorante|shampoo|champu|acondicionador|crema facial|maquillaje|labial|esmalte|perfume|colonia|after shave|depilador|cepillo dental|enjuague bucal|pañal adulto|preservativo|toalla femenina|tampón|protector diario/i;

function calculateRelevance(productName: string, query: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return 1;

  const nameLower = productName.toLowerCase();

  if (NON_GROCERY_KEYWORDS.test(nameLower)) {
    const queryLower = query.toLowerCase();
    const isIntentionalSearch = NON_GROCERY_KEYWORDS.test(queryLower);
    if (!isIntentionalSearch) return 0;
  }

  let matches = 0;
  for (const word of queryWords) {
    if (nameLower.includes(word)) matches++;
  }

  let score = matches / queryWords.length;

  if (queryWords[0] && nameLower.startsWith(queryWords[0])) {
    score = Math.min(1, score + 0.3);
  } else if (queryWords[0] && nameLower.includes(queryWords[0])) {
    score = Math.min(1, score + 0.1);
  }

  return score;
}

export async function comparePrices(
  query: string,
  apiToken: string
): Promise<PriceComparison> {
  const [jumboResults, liderResults, unimarcResults, tottusResults] = await Promise.all([
    searchJumbo(query, apiToken).catch(() => [] as ApifyProduct[]),
    searchLider(query, apiToken).catch(() => [] as ApifyProduct[]),
    searchUnimarc(query, apiToken).catch(() => [] as ApifyProduct[]),
    searchTottus(query, apiToken).catch(() => [] as ApifyProduct[]),
  ]);

  const allRaw = [...jumboResults, ...liderResults, ...unimarcResults, ...tottusResults].filter(
    (p) => p.inStock && p.price > 0
  );

  // Filtrar por relevancia: solo productos con score >= 0.4
  // Esto elimina resultados como "papas fritas americano" cuando
  // buscas "lomo vetado americano"
  const RELEVANCE_THRESHOLD = 0.4;
  let allResults = allRaw.filter(
    (p) => calculateRelevance(p.name, query) >= RELEVANCE_THRESHOLD
  );

  // Si el filtro elimino todo, usar todos (mejor algo que nada)
  if (allResults.length === 0) allResults = allRaw;

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
