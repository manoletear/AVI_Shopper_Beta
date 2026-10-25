import { z } from 'zod';

// ============================================
// Allergen constants
// ============================================

export const NORMALIZED_ALLERGENS = [
  'peanut',
  'tree_nut',
  'fish',
  'shellfish',
  'gluten',
  'milk',
  'egg',
  'soy',
  'sesame',
] as const;

export type NormalizedAllergen = (typeof NORMALIZED_ALLERGENS)[number];

export const STORE_NAMES = ['jumbo', 'lider', 'unimarc', 'tottus'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export const SOURCE_TYPES = ['store_page', 'open_food_facts', 'manufacturer', 'manual'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ALLERGEN_STATUSES = ['verified', 'partial', 'unverified'] as const;
export type AllergenStatus = (typeof ALLERGEN_STATUSES)[number];

export const SELLOS_CHILE = [
  'ALTO EN AZÚCARES',
  'ALTO EN GRASAS SATURADAS',
  'ALTO EN SODIO',
  'ALTO EN CALORÍAS',
] as const;

// ============================================
// Zod schemas
// ============================================

export const productNutritionSchema = z.object({
  id: z.string().uuid().optional(),
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
  sodium_100mg: z.number().nullable().optional(),
  serving_size_g: z.number().nullable().optional(),

  sellos_chile: z.array(z.string()).default([]),

  source: z.enum(SOURCE_TYPES).default('manual'),
  source_url: z.string().url().nullable().optional(),
  fetched_at: z.string().datetime().nullable().optional(),
  allergen_status: z.enum(ALLERGEN_STATUSES).default('unverified'),
});

export type ProductNutrition = z.infer<typeof productNutritionSchema>;

// ============================================
// Open Food Facts response schema
// ============================================

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

// ============================================
// Allergen check result
// ============================================

export interface AllergenCheckResult {
  productId: string;
  productName: string;
  allergenStatus: AllergenStatus;
  blocked: boolean;
  requiresApproval: boolean;
  matchedAllergens: NormalizedAllergen[];
  matchedTraces: NormalizedAllergen[];
  familyMemberAllergens: Record<string, NormalizedAllergen[]>;
}
