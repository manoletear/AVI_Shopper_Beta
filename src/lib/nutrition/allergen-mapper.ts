import { NormalizedAllergen, NORMALIZED_ALLERGENS } from '@/types/nutrition';

const OFF_TAG_MAP: Record<string, NormalizedAllergen> = {
  'en:peanuts': 'peanut',
  'en:nuts': 'tree_nut',
  'en:tree-nuts': 'tree_nut',
  'en:almonds': 'tree_nut',
  'en:cashews': 'tree_nut',
  'en:walnuts': 'tree_nut',
  'en:hazelnuts': 'tree_nut',
  'en:pecans': 'tree_nut',
  'en:pistachios': 'tree_nut',
  'en:macadamia-nuts': 'tree_nut',
  'en:brazil-nuts': 'tree_nut',
  'en:fish': 'fish',
  'en:crustaceans': 'shellfish',
  'en:molluscs': 'shellfish',
  'en:gluten': 'gluten',
  'en:cereals-containing-gluten': 'gluten',
  'en:wheat': 'gluten',
  'en:barley': 'gluten',
  'en:rye': 'gluten',
  'en:oats': 'gluten',
  'en:milk': 'milk',
  'en:lactose': 'milk',
  'en:eggs': 'egg',
  'en:soybeans': 'soy',
  'en:soya': 'soy',
  'en:sesame-seeds': 'sesame',
  'en:sesame': 'sesame',
};

const ES_ALLERGEN_PATTERNS: Array<[RegExp, NormalizedAllergen]> = [
  [/man[ií]/, 'peanut'],
  [/cacahuet/, 'peanut'],
  [/nuez|nueces|almendra|avellana|casta[ñn]a|pistacho|pec[aá]n/, 'tree_nut'],
  [/frutos?\s*secos/, 'tree_nut'],
  [/pescado/, 'fish'],
  [/marisco|crust[aá]ceo|camar[oó]n|langost/, 'shellfish'],
  [/molusco|almeja|mejill[oó]n|calamar|pulpo/, 'shellfish'],
  [/gluten|trigo|cebada|centeno|avena/, 'gluten'],
  [/leche|l[aá]cte/, 'milk'],
  [/huevo/, 'egg'],
  [/soja|soya/, 'soy'],
  [/s[eé]samo|ajonjol[ií]/, 'sesame'],
];

/**
 * Maps Open Food Facts allergens_tags / traces_tags to normalized allergens.
 */
export function mapOFFTags(tags: string[]): NormalizedAllergen[] {
  const result = new Set<NormalizedAllergen>();

  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    const mapped = OFF_TAG_MAP[normalized];
    if (mapped) {
      result.add(mapped);
    }
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
    for (const a of list) {
      if (NORMALIZED_ALLERGENS.includes(a)) {
        result.add(a);
      }
    }
  }
  return Array.from(result).sort();
}

/**
 * Determines allergen_status based on data quality.
 */
export function determineAllergenStatus(
  ingredientsText: string | null | undefined,
  sourcesAgree: boolean
): 'verified' | 'partial' | 'unverified' {
  if (!ingredientsText || ingredientsText.trim().length === 0) {
    return 'unverified';
  }
  if (!sourcesAgree) {
    return 'partial';
  }
  return 'verified';
}
