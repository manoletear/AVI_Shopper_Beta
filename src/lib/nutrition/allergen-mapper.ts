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

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Plural +s (palabra que termina en vocal): merluza → merluzas. */
function pluralS(stem: string): string {
  return `${stem}s?`;
}

/** Plural +es (palabra que termina en consonante): salmón → salmones. */
function pluralEs(stem: string): string {
  return `${stem}(?:es)?`;
}

function wordPattern(parts: string[]): RegExp {
  return new RegExp(`\\b(?:${parts.join('|')})\\b`, 'i');
}

/**
 * Patrones sobre texto ya plegado (sin acentos, en minúsculas) y con
 * límite de palabra. Así "salmón" es pescado y "salmonella" no.
 */
const ES_ALLERGEN_PATTERNS: Array<[RegExp, NormalizedAllergen]> = [
  [wordPattern(['mani(?:es|s)?', pluralS('cacahuate'), pluralS('cacahuete')]), 'peanut'],
  [wordPattern([
    'nueces',
    'nuez',
    pluralS('almendra'),
    pluralS('avellana'),
    pluralS('pistacho'),
    pluralS('castana'),
    'caju',
    pluralS('anacardo'),
    pluralS('pecana'),
    'pecan(?:es|s)?',
    pluralS('macadamia'),
    'frutos?\\s+secos?',
  ]), 'tree_nut'],
  [wordPattern([
    pluralS('pescado'),
    pluralEs('salmon'),
    pluralS('merluza'),
    pluralEs('atun'),
    pluralS('anchoveta'),
    pluralS('anchoa'),
    pluralS('sardina'),
    pluralEs('jurel'),
    pluralS('reineta'),
    pluralS('congrio'),
    pluralS('bacalao'),
    pluralS('trucha'),
    pluralS('corvina'),
    pluralS('tilapia'),
    pluralS('caballa'),
    'surimi',
  ]), 'fish'],
  // "mariscos" en Chile cubre crustáceos y moluscos. Se marcan los dos.
  [wordPattern([pluralS('marisco')]), 'crustacean'],
  [wordPattern([pluralS('marisco')]), 'mollusc'],
  [wordPattern([
    pluralS('crustaceo'),
    pluralEs('camaron'),
    pluralS('langostino'),
    pluralS('cangrejo'),
    pluralS('jaiba'),
    pluralS('centolla'),
    pluralS('langosta'),
    'krill',
  ]), 'crustacean'],
  [wordPattern([
    pluralS('molusco'),
    pluralS('pulpo'),
    pluralEs('calamar'),
    pluralS('sepia'),
    pluralS('chorito'),
    pluralS('cholga'),
    pluralEs('mejillon'),
    pluralS('almeja'),
    pluralS('ostra'),
    pluralS('macha'),
    pluralS('loco'),
    pluralEs('ostion'),
  ]), 'mollusc'],
  [wordPattern(['gluten', 'trigo', 'cebada', 'centeno', 'avena']), 'gluten'],
  [wordPattern([pluralS('leche'), pluralS('lactea'), pluralS('lacteo')]), 'milk'],
  [wordPattern([pluralS('huevo')]), 'egg'],
  [wordPattern(['soja', 'soya']), 'soy'],
  [wordPattern(['sesamo', 'ajonjoli']), 'sesame'],
  [wordPattern(['sulfito', 'sulfitos', 'sulfite', 'sulfites']), 'sulfites'],
  [wordPattern(['mostaza']), 'mustard'],
  [wordPattern(['apio']), 'celery'],
  [wordPattern(['altramuz', 'lupin(?:os?)?']), 'lupin'],
];

const PUEDE_CONTENER = /\bpuede\s+contener\b/;

function matchPatterns(folded: string): NormalizedAllergen[] {
  const result = new Set<NormalizedAllergen>();

  for (const [pattern, allergen] of ES_ALLERGEN_PATTERNS) {
    if (pattern.test(folded)) result.add(allergen);
  }

  return Array.from(result).sort();
}

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
 * Extracts allergen mentions from Spanish ingredient or traces text.
 * Accent- and case-insensitive, with word boundaries.
 * "Puede contener salmón" también marca fish: la frase de trazas
 * usa el mismo matcher.
 */
export function extractAllergensFromText(text: string): NormalizedAllergen[] {
  return matchPatterns(fold(text));
}

/**
 * Separa ingredientes de la frase "puede contener".
 * Lo que va después de la frase queda en trazas, con las mismas especies.
 */
export function extractAllergensAndTracesFromText(text: string): {
  allergens: NormalizedAllergen[];
  traces: NormalizedAllergen[];
} {
  const folded = fold(text);
  const marker = PUEDE_CONTENER.exec(folded);
  if (!marker) {
    return { allergens: matchPatterns(folded), traces: [] };
  }
  return {
    allergens: matchPatterns(folded.slice(0, marker.index)),
    traces: matchPatterns(folded.slice(marker.index + marker[0].length)),
  };
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
