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
  sku?: string;
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

  return items.map((item: any) => {
    const sku = item.sku || item.product_id || item.id || '';
    const cartUrl = sku
      ? `https://www.unimarc.cl/checkout/cart/add?sku=${sku}&qty=1&seller=1&sc=1`
      : `https://www.unimarc.cl/search?q=${encodeURIComponent(item.name)}`;
    return {
    name: item.name,
    brand: item.brand || '',
    price: item.price,
    listPrice: item.list_price,
    inStock: (item.available_quantity ?? 1) > 0,
    store: 'Unimarc',
    sku,
    url: cartUrl,
    imageUrl: item.image,
    categories: item.categories,
  }});
}

// ============================================
// SEMANTIC SEARCH — Dictionary + Negative filter
// ============================================

const GROCERY_CONTEXT: Record<string, string> = {
  carbon: 'carbon vegetal parrilla',
  coca: 'coca cola bebida',
  pepsi: 'pepsi bebida',
  fanta: 'fanta bebida',
  sprite: 'sprite bebida',
  papel: 'papel higienico',
  toalla: 'toalla papel cocina',
  palta: 'palta hass',
  mantequilla: 'mantequilla',
  pan: 'pan molde marraqueta',
  cafe: 'cafe instantaneo nescafe',
  te: 'te negro verde',
  agua: 'agua mineral',
  aceite: 'aceite vegetal cocina',
  azucar: 'azucar blanca',
  sal: 'sal mesa',
  arroz: 'arroz grado',
  fideos: 'fideos tallarin',
  harina: 'harina trigo',
  leche: 'leche entera semidescremada',
  yogurt: 'yogurt',
  queso: 'queso laminado',
  jamon: 'jamon cerdo pavo',
  pollo: 'pollo entero pechuga',
  carne: 'carne vacuno molida',
  cerdo: 'cerdo pulpa chuleta',
  huevo: 'huevos docena',
  cerveza: 'cerveza lata pack',
  vino: 'vino tinto blanco',
  pisco: 'pisco',
  cloro: 'cloro limpieza',
  detergente: 'detergente ropa liquido',
  lavaloza: 'lavalozas',
  suavizante: 'suavizante ropa',
  esponja: 'esponja cocina',
  basura: 'bolsa basura',
  servilleta: 'servilletas',
  endulzante: 'endulzante stevia sucralosa',
  mayonesa: 'mayonesa',
  ketchup: 'ketchup',
  mostaza: 'mostaza',
  atun: 'atun lata conserva',
  sopa: 'sopa sobre crema',
  jugo: 'jugo natur botella',
  bebida: 'bebida gaseosa',
  cereal: 'cereal desayuno',
  galleta: 'galletas',
  chocolate: 'chocolate tableta',
  helado: 'helado litro',
  longaniza: 'longanizas cerdo',
  choricillo: 'choricillos parrilla',
  tomate: 'tomate',
  lechuga: 'lechuga',
  cebolla: 'cebolla',
  zanahoria: 'zanahoria',
  papa: 'papa',
  limon: 'limon',
  naranja: 'naranja',
  manzana: 'manzana',
  platano: 'platano banana',
  // Panaderia
  hallulla: 'hallulla pan',
  marraqueta: 'marraqueta pan',
  // Snacks
  ramitas: 'ramitas snack',
  doritos: 'doritos snack',
  // Condimentos
  oregano: 'oregano especias',
  comino: 'comino especias',
  pimienta: 'pimienta negra',
  canela: 'canela molida',
  merken: 'merken condimento',
  aji: 'aji pasta',
  // Salsas
  salsa: 'salsa de tomate',
  ketchup: 'ketchup',
  mostaza: 'mostaza',
  soya: 'salsa de soya',
  // Conservas
  atun: 'atun en lata conserva',
  durazno: 'durazno en conserva',
  arveja: 'arvejitas en lata',
  choclo: 'choclo en lata',
  // Congelados
  pizza: 'pizza congelada',
  empanada: 'empanadas congeladas',
  nugget: 'nuggets pollo congelado',
  // Bebe
  panal: 'panales bebe',
  formula: 'formula lactea bebe',
  compota: 'compota bebe fruta',
  // Mascotas
  'alimento perro': 'alimento perro adulto',
  'alimento gato': 'alimento gato adulto',
  arena: 'arena sanitaria gato',
  // Aseo personal (SI son grocery)
  jabon: 'jabon tocador',
  'pasta dientes': 'pasta de dientes',
  // Chileno
  manjar: 'manjar colun',
  mote: 'mote con huesillo',
  huesillo: 'huesillo deshidratado',
  sopaipilla: 'mezcla sopaipilla harina',
  'harina tostada': 'harina tostada',
  chancho: 'chancho en piedra salsa',
  // Lacteos extras
  crema: 'crema de leche',
  margarina: 'margarina',
  quesillo: 'quesillo',
  ricotta: 'ricotta queso',
  // Bebidas
  energetica: 'bebida energetica',
  isotonica: 'bebida isotonica gatorade',
  nectar: 'nectar jugo',
  'te frio': 'te frio botella',
};

const NON_GROCERY_CATEGORIES = /antitranspirante|desodorante|shampoo|champu|acondicionador|crema facial|crema corporal|maquillaje|labial|esmalte|perfume|colonia|after shave|depilador|cepillo dental|enjuague bucal|preservativo|protector diario|protector solar|bloqueador|base liquida|rimel|mascara pestana|sombra ojos|polvo compacto|desmaquillante|tinte pelo|tintura|cera depilatoria|gel fijador|laca pelo|mousse pelo|serum capilar|crema manos|locion corporal|jabon intimo|talco|repelente|insecticida|raticida|vela aromatica|ambientador|incienso|pilas|ampolleta|foco|encendedor|fosforo|carbon activ/i;

const GROCERY_POSITIVE = /leche|queso|yogurt|pan |pan$|huevo|pollo|carne|cerdo|arroz|fideos|aceite|azucar|harina|sal |mantequilla|cafe|te |jugo|agua |bebida|cerveza|vino|pisco|atun|sopa|cereal|galleta|chocolate|helado|mermelada|miel|manjar|mayonesa|ketchup|mostaza|tomate|lechuga|palta|cebolla|papa|zanahoria|limon|naranja|manzana|platano|detergente|cloro|lavaloza|papel hig|servilleta|bolsa basura|esponja|suavizante/i;

function expandQuery(query: string): string {
  const q = query.toLowerCase().trim();
  for (const [key, expanded] of Object.entries(GROCERY_CONTEXT)) {
    if (q === key || q.startsWith(key + ' ')) {
      return expanded;
    }
  }
  return query;
}

function calculateRelevance(productName: string, query: string): number {
  const expandedQuery = expandQuery(query);
  const queryWords = expandedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return 1;

  const nameLower = productName.toLowerCase();

  // Hard reject non-grocery products unless intentionally searched
  if (NON_GROCERY_CATEGORIES.test(nameLower) && !NON_GROCERY_CATEGORIES.test(query.toLowerCase())) {
    return 0;
  }

  // Boost if product is clearly grocery
  const isGrocery = GROCERY_POSITIVE.test(nameLower);

  let matches = 0;
  for (const word of queryWords) {
    if (nameLower.includes(word)) matches++;
  }

  let score = matches / queryWords.length;

  // Bonus: product name starts with the primary search term
  const primaryWord = query.toLowerCase().split(/\s+/)[0];
  if (primaryWord && nameLower.startsWith(primaryWord)) {
    score = Math.min(1, score + 0.3);
  } else if (primaryWord && nameLower.includes(primaryWord)) {
    score = Math.min(1, score + 0.15);
  }

  // Bonus for clearly grocery products
  if (isGrocery) {
    score = Math.min(1, score + 0.1);
  }

  return score;
}

export { expandQuery };

export async function comparePrices(
  query: string,
  apiToken: string
): Promise<PriceComparison> {
  const searchTerm = expandQuery(query);
  const [jumboResults, liderResults, unimarcResults, tottusResults] = await Promise.all([
    searchJumbo(searchTerm, apiToken).catch(() => [] as ApifyProduct[]),
    searchLider(searchTerm, apiToken).catch(() => [] as ApifyProduct[]),
    searchUnimarc(searchTerm, apiToken).catch(() => [] as ApifyProduct[]),
    searchTottus(searchTerm, apiToken).catch(() => [] as ApifyProduct[]),
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
