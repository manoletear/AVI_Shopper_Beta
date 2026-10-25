/**
 * fill-nutrition.ts
 *
 * Llena public.product_nutrition desde Open Food Facts y el catálogo Product.
 *
 * Uso:
 *   npx tsx scripts/fill-nutrition.ts
 *
 * Respeta el rate limit de OFF (1 req/s) y no reconsulta fetched_at < 30 días.
 * Alineado a la tabla viva: sodium_mg_100g, source/allergen_status text (sin enums),
 * source_detail jsonb, id text generado acá. No inventa identidad: sin ean,
 * store_sku ni canonical_product_id la fila se omite y se reporta.
 * OFF a solas nunca queda verified.
 */

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { determineAllergenStatus, inferSellosChile, mapOFFTags } from '../src/lib/nutrition';
import {
  nutritionIdentityError,
  productNutritionSchema,
  type ProductNutrition,
  type SourceType,
} from '../src/types/nutrition';

const prisma = new PrismaClient();

const CACHE_DAYS = 30;

interface ProductRow {
  id: string;
  name: string;
  barcode: string | null;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugar: number | null;
  sodium: number | null;
}

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number;
}

interface OffProductPayload {
  product_name?: string;
  brands?: string;
  quantity?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
  traces_tags?: string[];
  nutriments?: OffNutriments;
}

function filled(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOFF(ean: string): Promise<OffProductPayload | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json`,
      { headers: { 'User-Agent': 'AVI_Shopper/1.0 (contact: manuel.aravenal@gmail.com)' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return data.product as OffProductPayload;
  } catch {
    return null;
  }
}

async function shouldSkip(ean: string): Promise<boolean> {
  const existing = await prisma.$queryRaw<Array<{ fetched_at: Date | null }>>`
    SELECT fetched_at FROM product_nutrition WHERE ean = ${ean} LIMIT 1
  `.catch(() => []);

  if (existing.length === 0) return false;
  const fetchedAt = existing[0].fetched_at;
  if (!fetchedAt) return false;
  const daysSince = (Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < CACHE_DAYS;
}

async function upsertNutrition(row: ProductNutrition & { ean: string }) {
  const sourceDetail = JSON.stringify(row.source_detail ?? {});
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM product_nutrition WHERE ean = ${row.ean} LIMIT 1
  `;

  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE product_nutrition SET
        name = ${row.name},
        brand = ${row.brand ?? null},
        format = ${row.format ?? null},
        ingredients_text = ${row.ingredients_text ?? null},
        allergens = ${row.allergens}::text[],
        traces = ${row.traces}::text[],
        kcal_100g = ${row.kcal_100g ?? null}::double precision,
        protein_100g = ${row.protein_100g ?? null}::double precision,
        fat_100g = ${row.fat_100g ?? null}::double precision,
        carbs_100g = ${row.carbs_100g ?? null}::double precision,
        sugar_100g = ${row.sugar_100g ?? null}::double precision,
        sodium_mg_100g = ${row.sodium_mg_100g ?? null}::double precision,
        serving_size_g = ${row.serving_size_g ?? null}::double precision,
        sellos_chile = ${row.sellos_chile}::text[],
        source = ${row.source},
        source_url = ${row.source_url ?? null},
        source_detail = ${sourceDetail}::jsonb,
        allergen_status = ${row.allergen_status},
        fetched_at = now(),
        updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    return;
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO product_nutrition (
      id, ean, canonical_product_id, store, store_sku, brand, name, format,
      ingredients_text, allergens, traces,
      kcal_100g, protein_100g, fat_100g, carbs_100g, sugar_100g, sodium_mg_100g,
      serving_size_g, sellos_chile, source, source_url, source_detail,
      allergen_status, fetched_at
    ) VALUES (
      ${id},
      ${row.ean},
      ${row.canonical_product_id ?? null},
      ${row.store ?? null},
      ${row.store_sku ?? null},
      ${row.brand ?? null},
      ${row.name},
      ${row.format ?? null},
      ${row.ingredients_text ?? null},
      ${row.allergens}::text[],
      ${row.traces}::text[],
      ${row.kcal_100g ?? null}::double precision,
      ${row.protein_100g ?? null}::double precision,
      ${row.fat_100g ?? null}::double precision,
      ${row.carbs_100g ?? null}::double precision,
      ${row.sugar_100g ?? null}::double precision,
      ${row.sodium_mg_100g ?? null}::double precision,
      ${row.serving_size_g ?? null}::double precision,
      ${row.sellos_chile}::text[],
      ${row.source},
      ${row.source_url ?? null},
      ${sourceDetail}::jsonb,
      ${row.allergen_status},
      now()
    )
  `;
}

function draftRow(input: {
  ean: string | null;
  name: string;
  brand: string | null;
  format: string | null;
  ingredients_text: string | null;
  allergens: string[];
  traces: string[];
  nutriments: OffNutriments | undefined;
  fallback: ProductRow;
  source: SourceType;
  source_url: string | null;
  source_detail: Record<string, unknown>;
  allergen_status: ProductNutrition['allergen_status'];
}) {
  const sodiumFromOff = input.nutriments?.sodium_100g;
  return {
    ean: input.ean,
    canonical_product_id: null,
    store: null,
    store_sku: null,
    name: input.name,
    brand: input.brand,
    format: input.format,
    ingredients_text: input.ingredients_text,
    allergens: input.allergens,
    traces: input.traces,
    kcal_100g: input.nutriments?.['energy-kcal_100g'] ?? input.fallback.calories,
    protein_100g: input.nutriments?.proteins_100g ?? input.fallback.protein,
    fat_100g: input.nutriments?.fat_100g ?? input.fallback.fat,
    carbs_100g: input.nutriments?.carbohydrates_100g ?? input.fallback.carbs,
    sugar_100g: input.nutriments?.sugars_100g ?? input.fallback.sugar,
    sodium_mg_100g: sodiumFromOff != null ? sodiumFromOff * 1000 : input.fallback.sodium,
    sellos_chile: inferSellosChile(input.nutriments),
    source: input.source,
    source_url: input.source_url,
    source_detail: input.source_detail,
    allergen_status: input.allergen_status,
  };
}

async function main() {
  console.log('fill-nutrition: consultando productos existentes...');

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      barcode: true,
      brand: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
      sugar: true,
      sodium: true,
    },
  }) as ProductRow[];

  console.log(`${products.length} productos encontrados.`);

  let verified = 0;
  let partial = 0;
  let unverified = 0;
  let skippedCache = 0;
  let skippedIdentity = 0;
  const flagged: string[] = [];

  for (const product of products) {
    const ean = filled(product.barcode);
    const identityError = nutritionIdentityError({
      ean,
      store_sku: null,
      canonical_product_id: null,
    });
    if (identityError || !ean) {
      skippedIdentity++;
      flagged.push(product.name);
      console.log(`🚩 ${product.name} → omitido (${identityError ?? 'sin identidad'}). No se inventa identidad.`);
      continue;
    }

    if (await shouldSkip(ean)) {
      skippedCache++;
      console.log(`⏭  ${product.name} (cache válido)`);
      continue;
    }

    console.log(`Buscando EAN ${ean} en Open Food Facts...`);
    const offData = await fetchOFF(ean);
    await sleep(1000);

    const ingredients = offData?.ingredients_text ?? null;
    const source: SourceType = offData ? 'open_food_facts' : 'manual';
    const status = determineAllergenStatus(ingredients, source, true);
    const candidate = draftRow({
      ean,
      name: offData?.product_name || product.name,
      brand: offData?.brands || product.brand,
      format: offData?.quantity || null,
      ingredients_text: ingredients,
      allergens: offData ? mapOFFTags(offData.allergens_tags || []) : [],
      traces: offData ? mapOFFTags(offData.traces_tags || []) : [],
      nutriments: offData?.nutriments,
      fallback: product,
      source,
      source_url: offData ? `https://world.openfoodfacts.org/product/${ean}` : null,
      source_detail: offData
        ? {
            provider: 'open_food_facts',
            ean,
            allergens_tags: offData.allergens_tags ?? [],
            traces_tags: offData.traces_tags ?? [],
          }
        : { provider: 'manual', reason: 'sin_datos_off', ean },
      allergen_status: status,
    });

    const parsed = productNutritionSchema.safeParse(candidate);
    if (!parsed.success || !parsed.data.ean) {
      skippedIdentity++;
      flagged.push(product.name);
      console.log(`🚩 ${product.name} → omitido, la fila no cumple la tabla viva.`);
      continue;
    }

    await upsertNutrition({ ...parsed.data, ean: parsed.data.ean });

    if (parsed.data.allergen_status === 'verified') verified++;
    else if (parsed.data.allergen_status === 'partial') partial++;
    else unverified++;
    console.log(`  ${product.name} → ${parsed.data.allergen_status}`);
  }

  const total = verified + partial + unverified;
  console.log('\nReporte de cobertura:');
  console.log(`  Total escritos: ${total} (${skippedCache} en caché, ${skippedIdentity} sin identidad)`);
  console.log(`  Verified:   ${verified} (${total > 0 ? ((verified / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Partial:    ${partial} (${total > 0 ? ((partial / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  Unverified: ${unverified} (${total > 0 ? ((unverified / total) * 100).toFixed(1) : 0}%)`);
  if (flagged.length > 0) {
    console.log(`  Omitidos por identidad (${flagged.length}):`);
    for (const name of flagged) console.log(`    - ${name}`);
  }
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
