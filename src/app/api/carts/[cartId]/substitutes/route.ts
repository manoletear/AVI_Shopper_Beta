import { prisma } from '@/lib/prisma';
import { assertApprover, familyErrorResponse, requireFamilyMembership } from '@/lib/family-auth';
import { errorResponse, successResponse } from '@/lib/responses';
import { checkAllergensForFamily, getLockedProducts } from '@/lib/mcp/tools';
import {
  applySubstituteDecision,
  parseSubstitutes,
  substituteDecisionSchema,
  SubstituteDecisionError,
  summarizeSubstitutes,
  type StoredSubstitute,
} from '@/lib/stores/substitutes';
import type { StoreProduct } from '@/lib/stores/types';
import { ALLERGENS_NOT_VERIFIED_NOTICE, type AllergenWarning } from '@/types/nutrition';

export const dynamic = 'force-dynamic';

type Context = { params: { cartId: string } };

/** Carro y último llenado, siempre filtrados por la familia de la sesión. */
async function loadFill(familyId: string, cartId: string) {
  const cart = await prisma.proposedCart.findFirst({ where: { id: cartId, familyId }, select: { id: true } });
  if (!cart) return null;
  const fill = await prisma.storeCartFill.findFirst({
    where: { cartId: cart.id, familyId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, storeSlug: true, status: true, substitutes: true },
  });
  return { cartId: cart.id, fill };
}

/** Canónico del sustituto vía la ficha conocida en la tienda (si existe). */
async function candidateCanonicalId(storeSlug: string, candidate: StoreProduct | null): Promise<string | null> {
  if (!candidate?.url) return null;
  const listing = await prisma.storeListing.findFirst({
    where: { storeSlug, url: candidate.url, canonicalId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: { canonicalId: true },
  });
  return listing?.canonicalId ?? null;
}

/** Advertencias por integrante. Nunca bloquea; sin ficha nutricional avisa "no verificado". */
async function candidateAllergens(
  familyId: string,
  storeSlug: string,
  candidate: StoreProduct | null,
): Promise<{ warnings: AllergenWarning[]; notice: string | null }> {
  if (!candidate) return { warnings: [], notice: null };
  let nutritionId: string | null = null;
  if (candidate.sku) {
    const row = await prisma.productNutrition.findFirst({ where: { store: storeSlug, storeSku: candidate.sku }, select: { id: true } });
    nutritionId = row?.id ?? null;
  }
  if (!nutritionId) {
    const canonicalId = await candidateCanonicalId(storeSlug, candidate);
    if (canonicalId) {
      const row = await prisma.productNutrition.findFirst({ where: { canonicalProductId: canonicalId }, select: { id: true } });
      nutritionId = row?.id ?? null;
    }
  }
  if (!nutritionId) return { warnings: [], notice: ALLERGENS_NOT_VERIFIED_NOTICE };
  const result = await checkAllergensForFamily(familyId, nutritionId);
  return { warnings: result.warnings, notice: result.notice };
}

async function describeSubstitutes(familyId: string, cartId: string, storeSlug: string, substitutes: StoredSubstitute[]) {
  const items = await prisma.proposedCartItem.findMany({
    where: { cartId, id: { in: substitutes.map((row) => row.itemId) } },
    select: { id: true, quantity: true, unit: true, payable: true, canonicalProductId: true },
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  const locked = new Set((await getLockedProducts(familyId)).map((row) => row.canonicalProductId));
  return Promise.all(
    substitutes.map(async (row) => {
      const original = byId.get(row.itemId);
      return {
        itemId: row.itemId,
        name: row.name,
        reason: row.reason,
        approval: row.approval,
        decidedAt: row.decidedAt ?? null,
        candidate: row.candidate
          ? { name: row.candidate.name, brand: row.candidate.brand ?? null, price: row.candidate.price, available: row.candidate.available, url: row.candidate.url }
          : null,
        original: original ? { quantity: original.quantity, unit: original.unit, payable: original.payable } : null,
        isLocked: Boolean(original?.canonicalProductId && locked.has(original.canonicalProductId)),
        allergens: await candidateAllergens(familyId, storeSlug, row.candidate),
      };
    }),
  );
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const { familyId, isApprover } = await requireFamilyMembership();
    const loaded = await loadFill(familyId, params.cartId);
    if (!loaded) return errorResponse('No encontré ese carro en tu familia', 404);
    if (!loaded.fill) {
      return successResponse({ cartId: loaded.cartId, fillId: null, store: null, isApprover, substitutes: [], summary: summarizeSubstitutes([]) });
    }
    const substitutes = parseSubstitutes(loaded.fill.substitutes);
    return successResponse({
      cartId: loaded.cartId,
      fillId: loaded.fill.id,
      store: loaded.fill.storeSlug,
      isApprover,
      substitutes: await describeSubstitutes(familyId, loaded.cartId, loaded.fill.storeSlug, substitutes),
      summary: summarizeSubstitutes(substitutes),
    });
  } catch (error) {
    return familyErrorResponse(error, 'No pude cargar los sustitutos');
  }
}

/**
 * Solo el aprobador decide. Aprobar registra la decisión: no agrega nada al
 * carro de la tienda, no hace checkout ni paga.
 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const membership = await requireFamilyMembership();
    assertApprover(membership);
    const parsed = substituteDecisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse('Datos inválidos', 400);
    const decision = parsed.data;
    const { familyId } = membership;

    const loaded = await loadFill(familyId, params.cartId);
    if (!loaded) return errorResponse('No encontré ese carro en tu familia', 404);
    if (!loaded.fill) return errorResponse('Este carro aún no se llena en la tienda', 404);
    const fill = loaded.fill;

    const current = parseSubstitutes(fill.substitutes);
    const { substitutes, changed } = applySubstituteDecision(current, decision, {
      memberId: membership.memberId,
      isApprover: membership.isApprover,
    });

    // Escritura optimista: si otro aprobador cambió el JSON entretanto, 409.
    const updated = await prisma.storeCartFill.updateMany({
      where: { id: fill.id, familyId, substitutes: fill.substitutes },
      data: { substitutes: JSON.stringify(substitutes) },
    });
    if (updated.count === 0) return errorResponse('Los sustitutos cambiaron; recarga e intenta de nuevo', 409);

    let lockedUpdated = false;
    if (decision.action === 'approve' && decision.updateLockedProduct) {
      const target = substitutes.find((row) => row.itemId === decision.itemId);
      const original = await prisma.proposedCartItem.findFirst({
        where: { id: decision.itemId, cartId: loaded.cartId },
        select: { canonicalProductId: true },
      });
      const nextCanonical = await candidateCanonicalId(fill.storeSlug, target?.candidate ?? null);
      if (original?.canonicalProductId && nextCanonical && nextCanonical !== original.canonicalProductId) {
        const result = await prisma.memberPreference.updateMany({
          where: { avoid: false, preferredCanonicalId: original.canonicalProductId, member: { familyId } },
          data: { preferredCanonicalId: nextCanonical },
        });
        lockedUpdated = result.count > 0;
      }
    }

    return successResponse({
      fillId: fill.id,
      changed,
      lockedUpdated,
      substitutes: await describeSubstitutes(familyId, loaded.cartId, fill.storeSlug, substitutes),
      summary: summarizeSubstitutes(substitutes),
    });
  } catch (error) {
    if (error instanceof SubstituteDecisionError) return errorResponse(error.message, error.statusCode);
    return familyErrorResponse(error, 'No pude guardar la decisión');
  }
}
