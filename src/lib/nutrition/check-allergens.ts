import { prisma } from '@/lib/prisma';
import {
  AllergenCheckResult,
  AllergenStatus,
  NormalizedAllergen,
  NORMALIZED_ALLERGENS,
} from '@/types/nutrition';

const PRODUCT_VOCAB = new Set<string>(NORMALIZED_ALLERGENS);

/**
 * Alias de la familia → vocabulario de la tabla.
 * shellfish y mariscos cubren crustacean Y mollusc.
 * fish y pescado cubren solo fish: no bloquean mariscos.
 */
const FAMILY_ALIAS: Record<string, readonly NormalizedAllergen[]> = {
  shellfish: ['crustacean', 'mollusc'],
  mariscos: ['crustacean', 'mollusc'],
  marisco: ['crustacean', 'mollusc'],
  crustacean: ['crustacean'],
  crustaceans: ['crustacean'],
  crustaceo: ['crustacean'],
  crustaceos: ['crustacean'],
  mollusc: ['mollusc'],
  molluscs: ['mollusc'],
  mollusk: ['mollusc'],
  mollusks: ['mollusc'],
  molusco: ['mollusc'],
  moluscos: ['mollusc'],
  fish: ['fish'],
  pescado: ['fish'],
  pescados: ['fish'],
  peanut: ['peanut'],
  peanuts: ['peanut'],
  mani: ['peanut'],
  tree_nut: ['tree_nut'],
  frutos_secos: ['tree_nut'],
  gluten: ['gluten'],
  milk: ['milk'],
  lacteos: ['milk'],
  lactosa: ['milk'],
  egg: ['egg'],
  huevo: ['egg'],
  huevos: ['egg'],
  soy: ['soy'],
  soya: ['soy'],
  soja: ['soy'],
  sesame: ['sesame'],
  sesamo: ['sesame'],
  sulfites: ['sulfites'],
  sulfitos: ['sulfites'],
  mustard: ['mustard'],
  mostaza: ['mustard'],
  celery: ['celery'],
  apio: ['celery'],
  lupin: ['lupin'],
  lupino: ['lupin'],
  altramuz: ['lupin'],
};

function foldToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_');
}

export function expandFamilyAllergens(familyAllergens: Iterable<string>): Set<NormalizedAllergen> {
  const expanded = new Set<NormalizedAllergen>();
  for (const raw of familyAllergens) {
    const key = foldToken(raw);
    const mapped = FAMILY_ALIAS[key];
    if (mapped) {
      for (const allergen of mapped) expanded.add(allergen);
      continue;
    }
    if (PRODUCT_VOCAB.has(key)) expanded.add(key as NormalizedAllergen);
  }
  return expanded;
}

function matchingTokens(
  tokens: readonly string[],
  family: Set<NormalizedAllergen>,
): NormalizedAllergen[] {
  const matched = new Set<NormalizedAllergen>();
  for (const token of tokens) {
    for (const allergen of expandFamilyAllergens([token])) {
      if (family.has(allergen)) matched.add(allergen);
    }
  }
  return Array.from(matched).sort();
}

/**
 * Pure decision logic. Any allergen OR trace match blocks the product,
 * regardless of allergen_status. Without a match, 'unverified' and 'partial'
 * require explicit human approval; 'verified' is safe.
 *
 * Una alergia familiar shellfish/mariscos bloquea crustacean y mollusc.
 * fish/pescado no bloquea mariscos.
 */
export function evaluateAllergens(
  allergens: readonly string[],
  traces: readonly string[],
  status: AllergenStatus,
  familyAllergens: Iterable<string>,
): {
  matchedAllergens: NormalizedAllergen[];
  matchedTraces: NormalizedAllergen[];
  blocked: boolean;
  requiresApproval: boolean;
} {
  const family = expandFamilyAllergens(familyAllergens);
  const matchedAllergens = matchingTokens(allergens, family);
  const matchedTraces = matchingTokens(traces, family);
  const hasMatch = matchedAllergens.length > 0 || matchedTraces.length > 0;
  if (hasMatch) {
    return { matchedAllergens, matchedTraces, blocked: true, requiresApproval: false };
  }
  return {
    matchedAllergens,
    matchedTraces,
    blocked: false,
    requiresApproval: status !== 'verified',
  };
}

export function collectFamilyAllergenTokens(
  familyAllergens: Record<string, readonly string[]>,
): string[] {
  const tokens: string[] = [];
  for (const memberAllergens of Object.values(familyAllergens)) {
    for (const allergen of memberAllergens) tokens.push(allergen);
  }
  return tokens;
}

export function evaluateProductForFamily(
  product: {
    allergens: readonly string[];
    traces: readonly string[];
    allergenStatus: AllergenStatus;
  },
  familyAllergens: Record<string, readonly string[]>,
) {
  return evaluateAllergens(
    product.allergens,
    product.traces,
    product.allergenStatus,
    collectFamilyAllergenTokens(familyAllergens),
  );
}

function asStatus(value: string): AllergenStatus {
  if (value === 'verified' || value === 'partial' || value === 'unverified') return value;
  return 'unverified';
}

/**
 * Checks a product's allergens against a family's known allergies.
 *
 * Rules:
 * - shellfish / mariscos → bloquea crustacean y mollusc (alérgeno o traza, cualquier status)
 * - fish / pescado → solo fish
 * - 'unverified' o 'partial' sin match → requiresApproval
 * - 'verified' sin match → safe
 */
export async function checkAllergens(
  productNutritionId: string,
  familyAllergens: Record<string, readonly string[]>,
): Promise<AllergenCheckResult> {
  const product = await prisma.productNutrition.findUnique({
    where: { id: productNutritionId },
    select: {
      id: true,
      name: true,
      allergens: true,
      traces: true,
      allergenStatus: true,
    },
  });

  if (!product) {
    return {
      productId: productNutritionId,
      productName: 'Unknown',
      allergenStatus: 'unverified',
      blocked: false,
      requiresApproval: true,
      matchedAllergens: [],
      matchedTraces: [],
      familyMemberAllergens: familyAllergens,
    };
  }

  const status = asStatus(product.allergenStatus);
  const decision = evaluateProductForFamily(
    {
      allergens: product.allergens ?? [],
      traces: product.traces ?? [],
      allergenStatus: status,
    },
    familyAllergens,
  );

  return {
    productId: productNutritionId,
    productName: product.name,
    allergenStatus: status,
    blocked: decision.blocked,
    requiresApproval: decision.requiresApproval,
    matchedAllergens: decision.matchedAllergens,
    matchedTraces: decision.matchedTraces,
    familyMemberAllergens: familyAllergens,
  };
}

/**
 * Batch check: filters a list of product IDs, returning which are safe,
 * which are blocked, and which need approval.
 */
export async function batchCheckAllergens(
  productNutritionIds: string[],
  familyAllergens: Record<string, readonly string[]>,
): Promise<{
  safe: AllergenCheckResult[];
  blocked: AllergenCheckResult[];
  needsApproval: AllergenCheckResult[];
}> {
  const results = await Promise.all(
    productNutritionIds.map((id) => checkAllergens(id, familyAllergens)),
  );

  return {
    safe: results.filter((row) => !row.blocked && !row.requiresApproval),
    blocked: results.filter((row) => row.blocked),
    needsApproval: results.filter((row) => row.requiresApproval && !row.blocked),
  };
}
