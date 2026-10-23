const STOPWORDS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'en', 'con', 'para', 'del', 'al', 'por']);

const FLAVORS = [
  'chocolate',
  'frutilla',
  'vainilla',
  'manjar',
  'capuccino',
  'cappuccino',
  'frambuesa',
  'platano',
  'banana',
  'durazno',
  'lucuma',
];

export function normalizeGrocery(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(litros|litro|lts|lt)\b/g, 'l')
    .replace(/(\d+)\s*l\b/g, '$1l')
    .replace(/(\d+)\s*(ml|kg|g|cc)\b/g, '$1$2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalizeGrocery(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/** 0 a 1. Prefiere el nombre que cubre la búsqueda y no mete un sabor que nadie pidió. */
export function scoreProductName(query: string, name: string, brand?: string): number {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return 0;

  const haystack = normalizeGrocery(`${name} ${brand || ''}`);
  let hits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) hits += 1;
  }
  let score = hits / queryTokens.length;

  const normalizedQuery = normalizeGrocery(query);
  const normalizedName = normalizeGrocery(name);
  for (const flavor of FLAVORS) {
    if (normalizedName.includes(flavor) && !normalizedQuery.includes(flavor)) {
      score -= 0.45;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function pickBestMatch<T extends { name: string; brand?: string }>(
  query: string,
  products: T[],
  minScore = 0.5
): { product: T; score: number } | null {
  let bestProduct: T | null = null;
  let bestScore = -1;
  let bestIndex = -1;

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const score = scoreProductName(query, product.name, product.brand);
    const better = score > bestScore + 0.02 || (Math.abs(score - bestScore) <= 0.02 && index < bestIndex);
    if (!bestProduct || better) {
      bestProduct = product;
      bestScore = score;
      bestIndex = index;
    }
  }

  if (!bestProduct || bestScore < minScore) return null;
  return { product: bestProduct, score: bestScore };
}
