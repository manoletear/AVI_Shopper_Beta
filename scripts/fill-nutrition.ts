/**
 * fill-nutrition.ts
 *
 * Script para llenar la tabla product_nutrition desde Open Food Facts
 * y productos existentes en la base de datos.
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fill-nutrition.ts
 *
 * Respeta rate limit de OFF API (1 req/s).
 * No reconsulta productos con fetched_at < 30 días.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Inline OFF fetch (no @/ imports in scripts)
// ============================================

const NORMALIZED_ALLERGENS = [
  'peanut', 'tree_nut', 'fish', 'shellfish', 'gluten', 'milk', 'egg', 'soy', 'sesame',
] as const;

type NormalizedAllergen = (typeof NORMALIZED_ALLERGENS)[number];

const OFF_TAG_MAP: Record<string, NormalizedAllergen> = {
  'en:peanuts': 'peanut', 'en:nuts': 'tree_nut', 'en:tree-nuts': 'tree_nut',
  'en:almonds': 'tree_nut', 'en:cashews': 'tree_nut', 'en:walnuts': 'tree_nut',
  'en:hazelnuts': 'tree_nut', 'en:fish': 'fish', 'en:crustaceans': 'shellfish',
  'en:molluscs': 'shellfish', 'en:gluten': 'gluten', 'en:cereals-containing-gluten': 'gluten',
  'en:wheat': 'gluten', 'en:milk': 'milk', 'en:lactose': 'milk', 'en:eggs': 'egg',
  'en:soybeans': 'soy', 'en:soya': 'soy', 'en:sesame-seeds': 'sesame', 'en:sesame': 'sesame',
};

function mapOFFTags(tags: string[]): NormalizedAllergen[] {
  const result = new Set<NormalizedAllergen>();
  for (const tag of tags) {
    const mapped = OFF_TAG_MAP[tag.toLowerCase().trim()];
    if (mapped) result.add(mapped);
  }
  return Array.from(result).sort();
}

const CACHE_DAYS = 30;

interface ProductRow {
  id: string;
  name: string;
  barcode: string | null;
  brand: string | null;
  category: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  sodium: number | null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOFF(ean: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json`,
      { headers: { 'User-Agent': 'AVI_Shopper/1.0 (contact: manuel.aravenal@gmail.com)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return data.product;
  } catch {
    return null;
  }
}

async function shouldSkip(ean: string | null): Promise<boolean> {
  if (!ean) return false;

  const existing = await prisma.$queryRaw<Array<{ fetched_at: Date | null }>>`
    SELECT fetched_at FROM product_nutrition WHERE ean = ${ean} LIMIT 1
  `.catch(() => []);

  if (existing.length === 0) return false;

  const fetchedAt = existing[0].fetched_at;
  if (!fetchedAt) return false;

  const daysSince = (Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < CACHE_DAYS;
}

async function upsertNutrition(data: {
  ean: string | null;
  name: string;
  brand: string | null;
  ingredients_text: string | null;
  allergens: string[];
  traces: string[];
  kcal_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  sugar_100g: number | null;
  sodium_100mg: number | null;
  sellos_chile: string[];
  source: string;
  source_url: string | null;
  allergen_status: string;
}) {
  if (data.ean) {
    await prisma.$executeRaw`
      INSERT INTO product_nutrition (
        ean, name, brand, ingredients_text, allergens, traces,
        kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, sodium_100mg,
        sellos_chile, source, source_url, fetched_at, allergen_status
      ) VALUES (
        ${data.ean}, ${data.name}, ${data.brand}, ${data.ingredients_text},
        ${data.allergens}::text[], ${data.traces}::text[],
        ${data.kcal_100g}::real, ${data.protein_100g}::real, ${data.fat_100g}::real,
        ${data.carbs_100g}::real, ${data.sugar_100g}::real, ${data.sodium_100mg}::real,
        ${data.sellos_chile}::text[], ${data.source}::allergen_source,
        ${data.source_url}, now(), ${data.allergen_status}::allergen_status
      )
      ON CONFLICT (ean) WHERE ean IS NOT NULL
      DO UPDATE SET
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        ingredients_text = EXCLUDED.ingredients_text,
        allergens = EXCLUDED.allergens,
        traces = EXCLUDED.traces,
        kcal_100g = EXCLUDED.kcal_100g,
        protein_100g = EXCLUDED.protein_100g,
        fat_100g = EXCLUDED.fat_100g,
        carbs_100g = EXCLUDED.carbs_100g,
        sugar_100g = EXCLUDED.sugar_100g,
        sodium_100mg = EXCLUDED.sodium_100mg,
        sellos_chile = EXCLUDED.sellos_chile,
        source = EXCLUDED.source,
        source_url = EXCLUDED.source_url,
        fetched_at = now(),
        allergen_status = EXCLUDED.allergen_status
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO product_nutrition (
        name, brand, ingredients_text, allergens, traces,
        kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, sodium_100mg,
        sellos_chile, source, source_url, fetched_at, allergen_status
      ) VALUES (
        ${data.name}, ${data.brand}, ${data.ingredients_text},
        ${data.allergens}::text[], ${data.traces}::text[],
        ${data.kcal_100g}::real, ${data.protein_100g}::real, ${data.fat_100g}::real,
        ${data.carbs_100g}::real, ${data.sugar_100g}::real, ${data.sodium_100mg}::real,
        ${data.sellos_chile}::text[], ${data.source}::allergen_source,
        ${data.source_url}, now(), ${data.allergen_status}::allergen_status
      )
    `;
  }
}

async function main() {
  console.log('🔍 fill-nutrition: Consultando productos existentes...');

  const products = await prisma.product.findMany({
    select: {
      id: true, name: true, barcode: true, brand: true, category: true,
      calories: true, protein: true, carbs: true, fat: true, sugar: true, sodium: true,
    },
  }) as ProductRow[];

  console.log(`📦 ${products.length} productos encontrados.`);

  let verified = 0, partial = 0, unverified = 0, skipped = 0;

  for (const product of products) {
    if (await shouldSkip(product.barcode)) {
      skipped++;
      console.log(`⏭  ${product.name} (cache válido)`);
      continue;
    }

    let offData: any = null;
    if (product.barcode) {
      console.log(`🌐 Buscando EAN ${product.barcode} en Open Food Facts...`);
      offData = await fetchOFF(product.barcode);
      await sleep(1000); // rate limit
    }

    if (offData) {
      const allergens = mapOFFTags(offData.allergens_tags || []);
      const traces = mapOFFTags(offData.traces_tags || []);
      const hasIngredients = !!offData.ingredients_text;
      const status = !hasIngredients ? 'unverified' : 'verified';

      await upsertNutrition({
        ean: product.barcode,
        name: offData.product_name || product.name,
        brand: offData.brands || product.brand,
        ingredients_text: offData.ingredients_text || null,
        allergens,
        traces,
        kcal_100g: offData.nutriments?.['energy-kcal_100g'] ?? product.calories,
        protein_100g: offData.nutriments?.proteins_100g ?? product.protein,
        fat_100g: offData.nutriments?.fat_100g ?? product.fat,
        carbs_100g: offData.nutriments?.carbohydrates_100g ?? product.carbs,
        sugar_100g: offData.nutriments?.sugars_100g ?? product.sugar,
        sodium_100mg: offData.nutriments?.sodium_100g != null
          ? offData.nutriments.sodium_100g * 1000
          : product.sodium,
        sellos_chile: [],
        source: 'open_food_facts',
        source_url: `https://world.openfoodfacts.org/product/${product.barcode}`,
        allergen_status: status,
      });

      if (status === 'verified') verified++;
      else unverified++;

      console.log(`  ✅ ${product.name} → ${status}`);
    } else {
      // Fallback: create entry from existing Product data
      await upsertNutrition({
        ean: product.barcode,
        name: product.name,
        brand: product.brand,
        ingredients_text: null,
        allergens: [],
        traces: [],
        kcal_100g: product.calories,
        protein_100g: product.protein,
        fat_100g: product.fat,
        carbs_100g: product.carbs,
        sugar_100g: product.sugar,
        sodium_100mg: product.sodium,
        sellos_chile: [],
        source: 'manual',
        source_url: null,
        allergen_status: 'unverified',
      });

      unverified++;
      console.log(`  ⚠️  ${product.name} → unverified (sin datos OFF)`);
    }
  }

  const total = verified + partial + unverified;
  console.log('\n📊 Reporte de cobertura:');
  console.log(`  Total procesados: ${total} (${skipped} saltados por caché)`);
  console.log(`  ✅ Verified:   ${verified} (${total > 0 ? ((verified / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  ⚠️  Partial:    ${partial} (${total > 0 ? ((partial / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  ❌ Unverified: ${unverified} (${total > 0 ? ((unverified / total) * 100).toFixed(1) : 0}%)`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
