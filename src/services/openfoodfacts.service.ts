/**
 * Open Food Facts Nutrition Service
 *
 * Enriquece productos con datos nutricionales reales de Open Food Facts.
 * API publica, sin autenticacion, datos de productos chilenos.
 *
 * https://world.openfoodfacts.org
 */

const OFF_API = 'https://world.openfoodfacts.org/cgi/search.pl';

export interface NutritionData {
  productName: string;
  brand: string;
  nutriscoreGrade: string | null;  // a, b, c, d, e
  novaGroup: number | null;         // 1 (sin procesar) a 4 (ultra-procesado)
  calories: number;                  // kcal por 100g
  fat: number;                      // g por 100g
  saturatedFat: number;
  carbohydrates: number;
  sugars: number;
  fiber: number;
  proteins: number;
  sodium: number;                    // g por 100g
  salt: number;
  isUltraProcessed: boolean;
  healthWarnings: string[];
}

interface OFFProduct {
  product_name?: string;
  brands?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  nutriments?: Record<string, number>;
}

/**
 * Busca un producto en Open Food Facts y retorna datos nutricionales
 */
export async function lookupNutrition(
  query: string,
  country = 'cl'
): Promise<NutritionData | null> {
  const params = new URLSearchParams({
    search_terms: query,
    json: '1',
    page_size: '1',
    cc: country,
    fields: 'product_name,brands,nutriscore_grade,nova_group,nutriments',
  });

  const res = await fetch(`${OFF_API}?${params}`, {
    headers: { 'User-Agent': 'AVI-Shopper/1.0 (avi-shopper-beta.vercel.app)' },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.products || data.products.length === 0) return null;

  const product: OFFProduct = data.products[0];
  const n = product.nutriments || {};

  const calories = n['energy-kcal_100g'] || n['energy_100g'] || 0;
  const fat = n['fat_100g'] || 0;
  const saturatedFat = n['saturated-fat_100g'] || 0;
  const carbs = n['carbohydrates_100g'] || 0;
  const sugars = n['sugars_100g'] || 0;
  const fiber = n['fiber_100g'] || 0;
  const proteins = n['proteins_100g'] || 0;
  const sodium = n['sodium_100g'] || 0;
  const salt = n['salt_100g'] || 0;

  const isUltraProcessed = (product.nova_group || 0) >= 4;

  const warnings: string[] = [];
  if (sugars > 12.5) warnings.push('Alto en azúcar');
  if (sodium > 0.6) warnings.push('Alto en sodio');
  if (saturatedFat > 5) warnings.push('Alto en grasas saturadas');
  if (calories > 400) warnings.push('Alto en calorías');
  if (isUltraProcessed) warnings.push('Ultra-procesado (NOVA 4)');

  return {
    productName: product.product_name || query,
    brand: product.brands || '',
    nutriscoreGrade: product.nutriscore_grade || null,
    novaGroup: product.nova_group || null,
    calories,
    fat,
    saturatedFat,
    carbohydrates: carbs,
    sugars,
    fiber,
    proteins,
    sodium,
    salt,
    isUltraProcessed,
    healthWarnings: warnings,
  };
}

/**
 * Enriquece una lista de productos con datos nutricionales
 */
export async function enrichProductsNutrition(
  products: Array<{ name: string; brand?: string }>
): Promise<Map<string, NutritionData | null>> {
  const results = new Map<string, NutritionData | null>();

  for (const product of products) {
    const searchTerm = product.brand
      ? `${product.name} ${product.brand}`
      : product.name;

    const nutrition = await lookupNutrition(searchTerm);
    results.set(product.name, nutrition);

    // Pausa para no saturar la API
    await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

/**
 * Genera un badge nutricional para mostrar en la UI
 */
export function getNutritionBadge(data: NutritionData): {
  label: string;
  color: string;
  score: string;
} {
  if (data.nutriscoreGrade) {
    const colors: Record<string, string> = {
      a: 'bg-green-100 text-green-700',
      b: 'bg-lime-100 text-lime-700',
      c: 'bg-amber-100 text-amber-700',
      d: 'bg-orange-100 text-orange-700',
      e: 'bg-red-100 text-red-700',
    };
    return {
      label: `NutriScore ${data.nutriscoreGrade.toUpperCase()}`,
      color: colors[data.nutriscoreGrade] || 'bg-gray-100 text-gray-700',
      score: data.nutriscoreGrade.toUpperCase(),
    };
  }

  // Fallback basado en NOVA
  if (data.novaGroup) {
    const novaLabels: Record<number, { label: string; color: string }> = {
      1: { label: 'Sin procesar', color: 'bg-green-100 text-green-700' },
      2: { label: 'Ingrediente culinario', color: 'bg-lime-100 text-lime-700' },
      3: { label: 'Procesado', color: 'bg-amber-100 text-amber-700' },
      4: { label: 'Ultra-procesado', color: 'bg-red-100 text-red-700' },
    };
    const nova = novaLabels[data.novaGroup] || { label: 'Sin dato', color: 'bg-gray-100 text-gray-700' };
    return { ...nova, score: `NOVA ${data.novaGroup}` };
  }

  return { label: 'Sin dato', color: 'bg-gray-100 text-gray-700', score: '?' };
}
