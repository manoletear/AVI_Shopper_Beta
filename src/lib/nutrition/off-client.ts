import { offProductSchema, OFFProduct, ProductNutrition } from '@/types/nutrition';
import { mapOFFTags, extractAllergensFromText, mergeAllergens, determineAllergenStatus } from './allergen-mapper';

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const RATE_LIMIT_MS = 1000; // 1 request per second per OFF API guidelines

let lastRequestAt = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestAt));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: { 'User-Agent': 'AVI_Shopper/1.0 (contact: manuel.aravenal@gmail.com)' },
  });
}

/**
 * Fetches product data from Open Food Facts by EAN barcode.
 * Returns null if product not found or API error.
 */
export async function fetchFromOpenFoodFacts(ean: string): Promise<ProductNutrition | null> {
  try {
    const response = await rateLimitedFetch(
      `${OFF_BASE_URL}/${encodeURIComponent(ean)}.json`
    );

    if (!response.ok) return null;

    const raw = await response.json();
    const parsed = offProductSchema.safeParse(raw);

    if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) {
      return null;
    }

    const p = parsed.data.product;
    const n = p.nutriments;

    const offAllergens = mapOFFTags(p.allergens_tags || []);
    const offTraces = mapOFFTags(p.traces_tags || []);
    const textAllergens = p.ingredients_text
      ? extractAllergensFromText(p.ingredients_text)
      : [];

    const allergens = mergeAllergens(offAllergens, textAllergens);
    const sourcesAgree =
      textAllergens.length === 0 ||
      textAllergens.every((a) => offAllergens.includes(a));

    const servingSizeStr = n?.['serving-size'];
    let servingSizeG: number | null = null;
    if (servingSizeStr) {
      const match = servingSizeStr.match(/(\d+(?:\.\d+)?)/);
      if (match) servingSizeG = parseFloat(match[1]);
    }

    return {
      ean,
      name: p.product_name || ean,
      brand: p.brands || null,
      format: p.quantity || null,
      ingredients_text: p.ingredients_text || null,
      allergens,
      traces: offTraces,
      kcal_100g: n?.['energy-kcal_100g'] ?? null,
      protein_100g: n?.proteins_100g ?? null,
      fat_100g: n?.fat_100g ?? null,
      carbs_100g: n?.carbohydrates_100g ?? null,
      sugar_100g: n?.sugars_100g ?? null,
      sodium_100mg: n?.sodium_100g != null ? n.sodium_100g * 1000 : null,
      serving_size_g: servingSizeG,
      sellos_chile: inferSellosChile(n),
      source: 'open_food_facts',
      source_url: `https://world.openfoodfacts.org/product/${ean}`,
      fetched_at: new Date().toISOString(),
      allergen_status: determineAllergenStatus(p.ingredients_text, sourcesAgree),
    };
  } catch (error) {
    console.error(`[OFF] Error fetching EAN ${ean}:`, error);
    return null;
  }
}

function inferSellosChile(
  n: NonNullable<OFFProduct['product']>['nutriments'] | undefined
): string[] {
  if (!n) return [];
  const sellos: string[] = [];

  if (n['energy-kcal_100g'] != null && n['energy-kcal_100g'] > 275) {
    sellos.push('ALTO EN CALORÍAS');
  }
  if (n.sugars_100g != null && n.sugars_100g > 10) {
    sellos.push('ALTO EN AZÚCARES');
  }
  if (n.fat_100g != null && n.fat_100g > 4) {
    sellos.push('ALTO EN GRASAS SATURADAS');
  }
  if (n.sodium_100g != null && n.sodium_100g > 0.4) {
    sellos.push('ALTO EN SODIO');
  }

  return sellos;
}
