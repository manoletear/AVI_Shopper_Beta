import { offProductSchema, ProductNutrition, SelloChile } from '@/types/nutrition';
import {
  mapOFFTags,
  extractAllergensAndTracesFromText,
  mergeAllergens,
  determineAllergenStatus,
} from './allergen-mapper';

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const RATE_LIMIT_MS = 1000;

let lastRequestAt = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestAt));
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
  return fetch(url, {
    headers: { 'User-Agent': 'AVI_Shopper/1.0 (contact: manuel.aravenal@gmail.com)' },
  });
}

export interface SelloNutriments {
  'energy-kcal_100g'?: number;
  sugars_100g?: number;
  fat_100g?: number;
  sodium_100g?: number;
}

/**
 * Sellos chilenos en el vocabulario de pn_sellos_vocab.
 * Los umbrales son los del código anterior (sólidos, aproximación).
 */
export function inferSellosChile(n: SelloNutriments | null | undefined): SelloChile[] {
  if (!n) return [];
  const sellos: SelloChile[] = [];

  if (n['energy-kcal_100g'] != null && n['energy-kcal_100g'] > 275) {
    sellos.push('alto_calorias');
  }
  if (n.sugars_100g != null && n.sugars_100g > 10) {
    sellos.push('alto_azucares');
  }
  if (n.fat_100g != null && n.fat_100g > 4) {
    sellos.push('alto_grasas_saturadas');
  }
  if (n.sodium_100g != null && n.sodium_100g > 0.4) {
    sellos.push('alto_sodio');
  }

  return sellos;
}

/**
 * Fetches product data from Open Food Facts by EAN barcode.
 * Returns null if product not found or API error.
 * OFF a solas nunca queda verified.
 */
export async function fetchFromOpenFoodFacts(ean: string): Promise<ProductNutrition | null> {
  try {
    const response = await rateLimitedFetch(
      `${OFF_BASE_URL}/${encodeURIComponent(ean)}.json`,
    );

    if (!response.ok) return null;

    const raw = await response.json();
    const parsed = offProductSchema.safeParse(raw);

    if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) {
      return null;
    }

    const product = parsed.data.product;
    const nutriments = product.nutriments;

    const offAllergens = mapOFFTags(product.allergens_tags || []);
    const offTraces = mapOFFTags(product.traces_tags || []);
    const fromText = extractAllergensAndTracesFromText(product.ingredients_text || '');

    const allergens = mergeAllergens(offAllergens, fromText.allergens);
    const sourcesAgree =
      fromText.allergens.length === 0 ||
      fromText.allergens.every((allergen) => offAllergens.includes(allergen));

    const servingSizeStr = nutriments?.['serving-size'];
    let servingSizeG: number | null = null;
    if (servingSizeStr) {
      const match = servingSizeStr.match(/(\d+(?:\.\d+)?)/);
      if (match) servingSizeG = parseFloat(match[1]);
    }

    return {
      ean,
      name: product.product_name || ean,
      brand: product.brands || null,
      format: product.quantity || null,
      ingredients_text: product.ingredients_text || null,
      allergens,
      traces: mergeAllergens(offTraces, fromText.traces),
      kcal_100g: nutriments?.['energy-kcal_100g'] ?? null,
      protein_100g: nutriments?.proteins_100g ?? null,
      fat_100g: nutriments?.fat_100g ?? null,
      carbs_100g: nutriments?.carbohydrates_100g ?? null,
      sugar_100g: nutriments?.sugars_100g ?? null,
      sodium_mg_100g: nutriments?.sodium_100g != null ? nutriments.sodium_100g * 1000 : null,
      serving_size_g: servingSizeG,
      sellos_chile: inferSellosChile(nutriments),
      source: 'open_food_facts',
      source_url: `https://world.openfoodfacts.org/product/${ean}`,
      source_detail: {
        provider: 'open_food_facts',
        ean,
        allergens_tags: product.allergens_tags ?? [],
        traces_tags: product.traces_tags ?? [],
      },
      fetched_at: new Date().toISOString(),
      allergen_status: determineAllergenStatus(product.ingredients_text, 'open_food_facts', sourcesAgree),
    };
  } catch (error) {
    console.error(`[OFF] Error fetching EAN ${ean}:`, error);
    return null;
  }
}
