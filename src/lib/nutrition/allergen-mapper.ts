import {
  AllergenStatus,
  NormalizedAllergen,
  NORMALIZED_ALLERGENS,
  SourceType,
  VERIFIED_SOURCES,
} from '@/types/nutrition';

const OFF_TAG_MAP: Record<string, readonly NormalizedAllergen[]> = {
  'en:peanuts': ['peanut'],
  'en:nuts': ['tree_nut'],
  'en:tree-nuts': ['tree_nut'],
  'en:almonds': ['tree_nut'],
  'en:cashews': ['tree_nut'],
  'en:walnuts': ['tree_nut'],
  'en:hazelnuts': ['tree_nut'],
  'en:pecans': ['tree_nut'],
  'en:pistachios': ['tree_nut'],
  'en:macadamia-nuts': ['tree_nut'],
  'en:brazil-nuts': ['tree_nut'],
  'en:fish': ['fish'],
  'en:crustaceans': ['crustacean'],
  'en:crustacean': ['crustacean'],
  'en:shrimp': ['crustacean'],
  'en:prawns': ['crustacean'],
  'en:crab': ['crustacean'],
  'en:lobster': ['crustacean'],
  'en:crayfish': ['crustacean'],
  'en:molluscs': ['mollusc'],
  'en:mollusks': ['mollusc'],
  'en:mollusc': ['mollusc'],
  'en:squid': ['mollusc'],
  'en:mussels': ['mollusc'],
  'en:oysters': ['mollusc'],
  'en:clams': ['mollusc'],
  'en:octopus': ['mollusc'],
  'en:shellfish': ['crustacean', 'mollusc'],
  'en:gluten': ['gluten'],
  'en:cereals-containing-gluten': ['gluten'],
  'en:wheat': ['gluten'],
  'en:barley': ['gluten'],
  'en:rye': ['gluten'],
  'en:oats': ['gluten'],
  'en:milk': ['milk'],
  'en:lactose': ['milk'],
  'en:eggs': ['egg'],
  'en:soybeans': ['soy'],
  'en:soya': ['soy'],
  'en:sesame-seeds': ['sesame'],
  'en:sesame': ['sesame'],
  'en:sulphur-dioxide-and-sulphites': ['sulfites'],
  'en:sulphites': ['sulfites'],
  'en:sulfites': ['sulfites'],
  'en:mustard': ['mustard'],
  'en:celery': ['celery'],
  'en:lupin': ['lupin'],
  'en:lupins': ['lupin'],
};

const ES_ALLERGEN_PATTERNS: Array<[RegExp, NormalizedAllergen]> = [
  [/man[ií]/, 'peanut'],
  [/cacahuet/, 'peanut'],
  [/nuez|nueces|almendra|avellana|casta[ñn]a|pistacho|pec[aá]n/, 'tree_nut'],
  [/frutos?\s*secos/, 'tree_nut'],
  [/pescado/, 'fish'],
  // "mariscos" en Chile cubre crustáceos y moluscos. Se marcan los dos.
  [/mariscos?/, 'crustacean'],
  [/mariscos?/, 'mollusc'],
  [/crust[aá]ceo|camar[oó]n|langost|jaiba/, 'crustacean'],
  [/molusco|almeja|mejill[oó]n|calamar|pulpo|ostra|chorito|cholga/, 'mollusc'],
  [/gluten|trigo|cebada|centeno|avena/, 'gluten'],
  [/leche|l[aá]cte/, 'milk'],
  [/huevo/, 'egg'],
  [/soja|soya/, 'soy'],
  [/s[eé]samo|ajonjol[ií]/, 'sesame'],
  [/sulfit/, 'sulfites'],
  [/mostaza/, 'mustard'],
  [/\bapio\b/, 'celery'],
  [/altramuz|lupino|\blupin\b/, 'lupin'],
];

/**
 * Maps Open Food Facts allergens_tags / traces_tags to the live vocabulary.
 * en:crustaceans → crustacean. en:molluscs → mollusc. No se colapsan a shellfish.
 */
export function mapOFFTags(tags: string[]): NormalizedAllergen[] {
  const result = new Set<NormalizedAllergen>();

  for (const tag of tags) {
    const mapped = OFF_TAG_MAP[tag.toLowerCase().trim()];
    if (!mapped) continue;
    for (const allergen of mapped) result.add(allergen);
  }

  return Array.from(result).sort();
}

/**
 * Extracts allergens from Spanish ingredient text.
 */
export function extractAllergensFromText(text: string): NormalizedAllergen[] {
  const result = new Set<NormalizedAllergen>();
  const lower = text.toLowerCase();

  for (const [pattern, allergen] of ES_ALLERGEN_PATTERNS) {
    if (pattern.test(lower)) {
      result.add(allergen);
    }
  }

  return Array.from(result).sort();
}

/**
 * Merges allergens from multiple sources. Takes the UNION (most restrictive).
 */
export function mergeAllergens(
  ...lists: NormalizedAllergen[][]
): NormalizedAllergen[] {
  const result = new Set<NormalizedAllergen>();
  for (const list of lists) {
    for (const allergen of list) {
      if (NORMALIZED_ALLERGENS.includes(allergen)) {
        result.add(allergen);
      }
    }
  }
  return Array.from(result).sort();
}

/**
 * pn_verified_rule: verified solo con ingredientes y fuente
 * store_page, manufacturer o manual. Open Food Facts a solas queda partial
 * (o unverified si no hay ingredientes).
 */
export function determineAllergenStatus(
  ingredientsText: string | null | undefined,
  source: SourceType,
  sourcesAgree = true,
): AllergenStatus {
  if (!ingredientsText || ingredientsText.trim().length === 0) {
    return 'unverified';
  }
  if (source === 'open_food_facts') {
    return 'partial';
  }
  const canVerify = (VERIFIED_SOURCES as readonly string[]).includes(source);
  if (!canVerify || !sourcesAgree) {
    return 'partial';
  }
  return 'verified';
}
