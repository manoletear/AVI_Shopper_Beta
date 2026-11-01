import { z } from 'zod';
import { storeProductSchema, type StoreProduct } from './types';

/**
 * Decisiones del aprobador sobre sustitutos (store_cart_fills.substitutes, JSON).
 * AVI propone, la familia decide: aprobar solo registra la decisión; no agrega
 * nada al carro de la tienda ni paga.
 */

export type SubstituteApproval = 'pending' | 'approved' | 'rejected';

export interface StoredSubstitute {
  itemId: string;
  name: string;
  reason: string;
  candidate: StoreProduct | null;
  approval: SubstituteApproval;
  decidedByMemberId?: string;
  decidedAt?: string;
}

const storedSubstituteSchema = z.object({
  itemId: z.string().min(1),
  name: z.string(),
  reason: z.string(),
  candidate: storeProductSchema.nullable().catch(null),
  approval: z.enum(['pending', 'approved', 'rejected']).catch('pending'),
  decidedByMemberId: z.string().optional(),
  decidedAt: z.string().optional(),
});

export function parseSubstitutes(raw: string | null | undefined): StoredSubstitute[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((row) => {
    const result = storedSubstituteSchema.safeParse(row);
    return result.success ? [result.data] : [];
  });
}

export const substituteDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    itemId: z.string().min(1).max(100),
    updateLockedProduct: z.boolean().optional(),
  }),
  z.object({ action: z.literal('reject'), itemId: z.string().min(1).max(100) }),
  z.object({ action: z.literal('approve_all') }),
]);
export type SubstituteDecision = z.infer<typeof substituteDecisionSchema>;

export class SubstituteDecisionError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

export interface DecisionContext {
  memberId: string;
  isApprover: boolean;
  now?: Date;
}

/** Aplica la decisión. Solo el aprobador; solo sustitutos pendientes; sin candidato no se aprueba. */
export function applySubstituteDecision(
  substitutes: readonly StoredSubstitute[],
  decision: SubstituteDecision,
  ctx: DecisionContext,
): { substitutes: StoredSubstitute[]; changed: string[] } {
  if (!ctx.isApprover) {
    throw new SubstituteDecisionError('Solo quien aprueba el carro de la familia puede decidir sustitutos', 403);
  }
  const decidedAt = (ctx.now ?? new Date()).toISOString();
  const stamp = (row: StoredSubstitute, approval: SubstituteApproval): StoredSubstitute => ({
    ...row,
    approval,
    decidedByMemberId: ctx.memberId,
    decidedAt,
  });

  if (decision.action === 'approve_all') {
    const changed: string[] = [];
    const next = substitutes.map((row) => {
      if (row.approval !== 'pending' || !row.candidate) return { ...row };
      changed.push(row.itemId);
      return stamp(row, 'approved');
    });
    return { substitutes: next, changed };
  }

  const index = substitutes.findIndex((row) => row.itemId === decision.itemId);
  if (index === -1) throw new SubstituteDecisionError('No encontré ese sustituto en el carro', 404);
  const target = substitutes[index];
  if (target.approval !== 'pending') {
    throw new SubstituteDecisionError('Ese sustituto ya fue decidido', 409);
  }
  if (decision.action === 'approve' && !target.candidate) {
    throw new SubstituteDecisionError('No hay un producto sustituto que aprobar; solo puedes rechazarlo', 400);
  }
  const next = substitutes.map((row, i) => (i === index ? stamp(row, decision.action === 'approve' ? 'approved' : 'rejected') : { ...row }));
  return { substitutes: next, changed: [target.itemId] };
}

export function summarizeSubstitutes(substitutes: readonly StoredSubstitute[]) {
  const pending = substitutes.filter((row) => row.approval === 'pending').length;
  const approved = substitutes.filter((row) => row.approval === 'approved').length;
  const rejected = substitutes.filter((row) => row.approval === 'rejected').length;
  return { pending, approved, rejected, allDecided: pending === 0 };
}
