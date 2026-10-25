import { prisma } from '@/lib/prisma';
import { AllergenCheckResult, NormalizedAllergen } from '@/types/nutrition';

export type AllergenStatus = 'verified' | 'partial' | 'unverified';

/**
 * Pure decision logic. Any allergen OR trace match blocks the product,
 * regardless of allergen_status. Without a match, 'unverified' and 'partial'
 * require explicit human approval; 'verified' is safe.
 */
export function evaluateAllergens(
  allergens: string[],
  traces: string[],
  status: AllergenStatus,
  familyAllergens: Set<NormalizedAllergen>
): {
  matchedAllergens: NormalizedAllergen[];
  matchedTraces: NormalizedAllergen[];
  blocked: boolean;
  requiresApproval: boolean;
} {
  const matchedAllergens = (allergens as NormalizedAllergen[]).filter((a) => familyAllergens.has(a));
  const matchedTraces = (traces as NormalizedAllergen[]).filter((a) => familyAllergens.has(a));
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

/**
 * Checks a product's allergens against a family's known allergies.
 *
 * Rules:
 * - Any matching allergen or trace → blocked (whatever the status)
 * - 'unverified' or 'partial' without match → requiresApproval (never auto-added)
 * - 'verified' without match → safe
 */
export async function checkAllergens(
  productNutritionId: string,
  familyAllergens: Record<string, NormalizedAllergen[]>
): Promise<AllergenCheckResult> {
  // Get product nutrition data
  // Using raw query since product_nutrition may not be in Prisma schema yet
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    allergens: string[];
    traces: string[];
    allergen_status: string;
  }>>`
    SELECT id, name, allergens, traces, allergen_status
    FROM product_nutrition
    WHERE id = ${productNutritionId}::uuid
    LIMIT 1
  `;

  if (rows.length === 0) {
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

  const product = rows[0];
  const status = product.allergen_status as AllergenStatus;
  const allFamilyAllergens = new Set<NormalizedAllergen>();
  for (const memberAllergens of Object.values(familyAllergens)) {
    for (const a of memberAllergens) {
      allFamilyAllergens.add(a);
    }
  }

  const { matchedAllergens, matchedTraces, blocked, requiresApproval } = evaluateAllergens(
    product.allergens ?? [],
    product.traces ?? [],
    status,
    allFamilyAllergens
  );

  return {
    productId: productNutritionId,
    productName: product.name,
    allergenStatus: status,
    blocked,
    requiresApproval,
    matchedAllergens,
    matchedTraces,
    familyMemberAllergens: familyAllergens,
  };
}

/**
 * Batch check: filters a list of product IDs, returning which are safe,
 * which are blocked, and which need approval.
 */
export async function batchCheckAllergens(
  productNutritionIds: string[],
  familyAllergens: Record<string, NormalizedAllergen[]>
): Promise<{
  safe: AllergenCheckResult[];
  blocked: AllergenCheckResult[];
  needsApproval: AllergenCheckResult[];
}> {
  const results = await Promise.all(
    productNutritionIds.map((id) => checkAllergens(id, familyAllergens))
  );

  return {
    safe: results.filter((r) => !r.blocked && !r.requiresApproval),
    blocked: results.filter((r) => r.blocked),
    needsApproval: results.filter((r) => r.requiresApproval && !r.blocked),
  };
}
