import { z } from 'zod';

// Vocabulario de public.product_nutrition (CHECK pn_allergens_vocab / pn_traces_vocab).
// No existe "shellfish": crustáceos y moluscos van separados.
export const NORMALIZED_ALLERGENS = [
  'peanut',
  'tree_nut',
  'fish',
  'crustacean',
  'mollusc',
  'gluten',
  'milk',
  'egg',
  'soy',
  'sesame',
  'sulfites',
  'mustard',
  'celery',
  'lupin',
] as const;

export type NormalizedAllergen = (typeof NORMALIZED_ALLERGENS)[number];

export const STORE_NAMES = ['jumbo', 'lider', 'unimarc', 'tottus'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export const SOURCE_TYPES = ['store_page', 'open_food_facts', 'manufacturer', 'manual'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const VERIFIED_SOURCES = ['store_page', 'manufacturer', 'manual'] as const;
export type VerifiedSource = (typeof VERIFIED_SOURCES)[number];

export const ALLERGEN_STATUSES = ['verified', 'partial', 'unverified'] as const;
export type AllergenStatus = (typeof ALLERGEN_STATUSES)[number];

// CHECK pn_sellos_vocab. Tokens en snake_case, no las frases "ALTO EN ...".
export const SELLOS_CHILE = [
  'alto_azucares',
  'alto_grasas_saturadas',
  'alto_sodio',
  'alto_calorias',
] as const;

export type SelloChile = (typeof SELLOS_CHILE)[number];

export interface NutritionIdentity {
  ean?: string | null;
  store_sku?: string | null;
  canonical_product_id?: string | null;
  store?: string | null;
}

function filled(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * pn_has_identity y pn_sku_needs_store.
 * No inventa ean, store_sku ni canonical_product_id.
 */
export function nutritionIdentityError(row: NutritionIdentity): string | null {
  const ean = filled(row.ean);
  const sku = filled(row.store_sku);
  const canonical = filled(row.canonical_product_id);
  if (!ean && !sku && !canonical) {
    return 'pn_has_identity: se requiere ean, store_sku o canonical_product_id';
  }
  if (sku && !filled(row.store)) {
    return 'pn_sku_needs_store: store_sku requiere store';
  }
  return null;
}

export const productNutritionSchema = z.object({
  // text. La app genera uuid; no hay default del que dependa el insert.
  id: z.string().uuid().optional(),
  canonical_product_id: z.string().nullable().optional(),
  ean: z.string().nullable().optional(),
  store: z.enum(STORE_NAMES).nullable().optional(),
  store_sku: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  name: z.string().min(1),
  format: z.string().nullable().optional(),

  ingredients_text: z.string().nullable().optional(),
  allergens: z.array(z.enum(NORMALIZED_ALLERGENS)).default([]),
  traces: z.array(z.enum(NORMALIZED_ALLERGENS)).default([]),

  kcal_100g: z.number().nullable().optional(),
  protein_100g: z.number().nullable().optional(),
  fat_100g: z.number().nullable().optional(),
  carbs_100g: z.number().nullable().optional(),
  sugar_100g: z.number().nullable().optional(),
  sodium_mg_100g: z.number().nullable().optional(),
  serving_size_g: z.number().nullable().optional(),

  sellos_chile: z.array(z.enum(SELLOS_CHILE)).default([]),

  source: z.enum(SOURCE_TYPES).default('manual'),
  source_url: z.string().url().nullable().optional(),
  source_detail: z.record(z.string(), z.unknown()).default({}),
  fetched_at: z.string().datetime().nullable().optional(),
  allergen_status: z.enum(ALLERGEN_STATUSES).default('unverified'),
}).superRefine((row, ctx) => {
  const identity = nutritionIdentityError(row);
  if (identity) {
    ctx.addIssue({ code: 'custom', message: identity, path: ['ean'] });
  }
  if (row.allergen_status !== 'verified') return;
  const hasIngredients = typeof row.ingredients_text === 'string' && row.ingredients_text.trim().length > 0;
  const sourceOk = (VERIFIED_SOURCES as readonly string[]).includes(row.source);
  if (!hasIngredients || !sourceOk) {
    ctx.addIssue({
      code: 'custom',
      message: 'verified solo con ingredientes y fuente store_page, manufacturer o manual',
      path: ['allergen_status'],
    });
  }
});

export type ProductNutrition = z.infer<typeof productNutritionSchema>;

export const offProductSchema = z.object({
  code: z.string().optional(),
  product: z.object({
    product_name: z.string().optional(),
    brands: z.string().optional(),
    quantity: z.string().optional(),
    ingredients_text: z.string().optional(),
    allergens_tags: z.array(z.string()).optional(),
    traces_tags: z.array(z.string()).optional(),
    nutriments: z.object({
      'energy-kcal_100g': z.number().optional(),
      proteins_100g: z.number().optional(),
      fat_100g: z.number().optional(),
      carbohydrates_100g: z.number().optional(),
      sugars_100g: z.number().optional(),
      sodium_100g: z.number().optional(),
      'serving-size': z.string().optional(),
    }).passthrough().optional(),
  }).passthrough().optional(),
  status: z.number(),
});

export type OFFProduct = z.infer<typeof offProductSchema>;

export interface AllergenMemberRef {
  id: string;
  name: string;
}

/** Alergias de un integrante. No son de la familia completa. */
export interface MemberAllergies extends AllergenMemberRef {
  allergens: readonly string[];
}

export type AllergenWarningKind = 'contains' | 'traces';

export const ALLERGENS_NOT_VERIFIED_NOTICE = 'allergens not verified';

export interface AllergenWarning {
  allergen: NormalizedAllergen;
  kind: AllergenWarningKind;
  members: AllergenMemberRef[];
  /** Ej. "Contiene frutos secos — Claudia" o "Puede contener frutos secos — Claudia". */
  message: string;
}

/**
 * Un match no bloquea el producto: avisa y pide aprobación.
 * Sin match, unverified/partial también piden aprobación con notice.
 */
export interface AllergenDecision {
  warnings: AllergenWarning[];
  requiresApproval: boolean;
  notice: typeof ALLERGENS_NOT_VERIFIED_NOTICE | null;
}

export interface AllergenCheckResult extends AllergenDecision {
  productId: string;
  productName: string;
  allergenStatus: AllergenStatus;
}
