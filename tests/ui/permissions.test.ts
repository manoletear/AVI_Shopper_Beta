import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertApprover, canManageStores, resolveFamilyMembership, type MembershipDeps } from '../../src/lib/family-auth';
import { AppError } from '../../src/lib/errors';
import { fillCart, StoreToolError, type StoreRepo } from '../../src/lib/stores/fill-cart';
import { assertNoCheckout, CheckoutAttemptError, isForbiddenCheckoutUrl } from '../../src/lib/stores/guards';
import {
  applySubstituteDecision,
  parseSubstitutes,
  substituteDecisionSchema,
  SubstituteDecisionError,
  summarizeSubstitutes,
  type StoredSubstitute,
} from '../../src/lib/stores/substitutes';

const members = {
  'user-claudia': { id: 'fm-2', name: 'Claudia', role: 'master', familyId: 'fam-a' },
  'user-manuel': { id: 'fm-1', name: 'Manuel', role: 'adult', familyId: 'fam-a' },
  'user-kid': { id: 'fm-5', name: 'Clemente', role: 'child', familyId: 'fam-a' },
  'user-otra': { id: 'fm-9', name: 'Otra', role: 'master', familyId: 'fam-b' },
} as const;

const deps: MembershipDeps = {
  async findMember(userId) {
    return (members as Record<string, (typeof members)[keyof typeof members]>)[userId] ?? null;
  },
  async findSettings() {
    return { approverRole: 'master', stepState: null };
  },
};

function statusOf(error: unknown): number | undefined {
  return error instanceof AppError ? error.statusCode : undefined;
}

describe('pertenencia a la familia (servidor)', () => {
  it('sin sesión → 401', async () => {
    await assert.rejects(resolveFamilyMembership(null, deps), (e) => statusOf(e) === 401);
  });

  it('usuario sin familia → 403', async () => {
    await assert.rejects(resolveFamilyMembership('user-x', deps), (e) => statusOf(e) === 403);
  });

  it('el familyId sale del miembro, no del cliente', async () => {
    const a = await resolveFamilyMembership('user-manuel', deps);
    const b = await resolveFamilyMembership('user-otra', deps);
    assert.equal(a.familyId, 'fam-a');
    assert.equal(b.familyId, 'fam-b');
    assert.equal(a.memberId, 'fm-1');
  });

  it('aprobador según approverRole del hogar', async () => {
    assert.equal((await resolveFamilyMembership('user-claudia', deps)).isApprover, true);
    assert.equal((await resolveFamilyMembership('user-manuel', deps)).isApprover, false);
  });

  it('niños no conectan tiendas; adultos sí', async () => {
    assert.equal(canManageStores(await resolveFamilyMembership('user-kid', deps)), false);
    assert.equal(canManageStores(await resolveFamilyMembership('user-manuel', deps)), true);
  });

  it('assertApprover rechaza con 403 a quien no aprueba', async () => {
    const manuel = await resolveFamilyMembership('user-manuel', deps);
    assert.throws(() => assertApprover(manuel), (e) => statusOf(e) === 403);
    const claudia = await resolveFamilyMembership('user-claudia', deps);
    assert.doesNotThrow(() => assertApprover(claudia));
  });
});

const candidate = { sku: '123', name: 'Leche Soprole 1 L', brand: 'Soprole', price: 1190, available: true, url: 'https://www.jumbo.cl/leche' };
const subs = (): StoredSubstitute[] => [
  { itemId: 'i1', name: 'Leche Colun 1 L', reason: 'out_of_stock', candidate, approval: 'pending' },
  { itemId: 'i2', name: 'Jamón serrano', reason: 'not_found', candidate: null, approval: 'pending' },
  { itemId: 'i3', name: 'Queso', reason: 'out_of_stock', candidate: { ...candidate, name: 'Queso Colun' }, approval: 'pending' },
];
const approver = { memberId: 'fm-2', isApprover: true, now: new Date('2026-11-01T17:00:00Z') };

describe('decisiones sobre sustitutos', () => {
  it('quien no aprueba no puede decidir', () => {
    assert.throws(
      () => applySubstituteDecision(subs(), { action: 'approve', itemId: 'i1' }, { memberId: 'fm-1', isApprover: false }),
      (e) => e instanceof SubstituteDecisionError && e.statusCode === 403,
    );
    assert.throws(() => applySubstituteDecision(subs(), { action: 'approve_all' }, { memberId: 'fm-1', isApprover: false }), SubstituteDecisionError);
  });

  it('aprobar registra quién y cuándo, sin tocar los demás', () => {
    const { substitutes, changed } = applySubstituteDecision(subs(), { action: 'approve', itemId: 'i1' }, approver);
    assert.deepEqual(changed, ['i1']);
    assert.equal(substitutes[0].approval, 'approved');
    assert.equal(substitutes[0].decidedByMemberId, 'fm-2');
    assert.equal(substitutes[0].decidedAt, '2026-11-01T17:00:00.000Z');
    assert.equal(substitutes[1].approval, 'pending');
  });

  it('sin candidato no se aprueba, solo se rechaza', () => {
    assert.throws(() => applySubstituteDecision(subs(), { action: 'approve', itemId: 'i2' }, approver), (e) => e instanceof SubstituteDecisionError && e.statusCode === 400);
    const { substitutes } = applySubstituteDecision(subs(), { action: 'reject', itemId: 'i2' }, approver);
    assert.equal(substitutes[1].approval, 'rejected');
  });

  it('aprobar todos salta los que no tienen candidato', () => {
    const { substitutes, changed } = applySubstituteDecision(subs(), { action: 'approve_all' }, approver);
    assert.deepEqual(changed, ['i1', 'i3']);
    assert.equal(substitutes[1].approval, 'pending');
    assert.deepEqual(summarizeSubstitutes(substitutes), { pending: 1, approved: 2, rejected: 0, allDecided: false });
  });

  it('una decisión tomada no se reescribe; ítem inexistente → 404', () => {
    const { substitutes } = applySubstituteDecision(subs(), { action: 'reject', itemId: 'i1' }, approver);
    assert.throws(() => applySubstituteDecision(substitutes, { action: 'approve', itemId: 'i1' }, approver), (e) => e instanceof SubstituteDecisionError && e.statusCode === 409);
    assert.throws(() => applySubstituteDecision(subs(), { action: 'approve', itemId: 'nope' }, approver), (e) => e instanceof SubstituteDecisionError && e.statusCode === 404);
  });

  it('lee el JSON que guarda fill_cart y descarta basura', () => {
    const raw = JSON.stringify([{ itemId: 'i1', name: 'Leche', reason: 'out_of_stock', candidate, approval: 'pending' }, { foo: 1 }]);
    const parsed = parseSubstitutes(raw);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].approval, 'pending');
    assert.deepEqual(parseSubstitutes('no-json'), []);
    assert.deepEqual(parseSubstitutes('{}'), []);
  });

  it('el input se valida con Zod', () => {
    assert.equal(substituteDecisionSchema.safeParse({ action: 'approve', itemId: 'i1' }).success, true);
    assert.equal(substituteDecisionSchema.safeParse({ action: 'pay' }).success, false);
    assert.equal(substituteDecisionSchema.safeParse({ action: 'approve' }).success, false);
  });
});

describe('regla dura: nunca checkout ni pago', () => {
  it('assertNoCheckout bloquea pagar/checkout y deja pasar lo demás', () => {
    for (const action of ['checkout', 'Ir a pagar', 'place order', 'Finalizar compra', 'https://www.jumbo.cl/checkout/#/payment']) {
      assert.throws(() => assertNoCheckout(action), CheckoutAttemptError, action);
    }
    for (const action of ['fill cart', 'search product', 'get delivery windows', 'payable total']) {
      assert.doesNotThrow(() => assertNoCheckout(action), action);
    }
  });

  it('las guardas existentes siguen activas', () => {
    assert.equal(isForbiddenCheckoutUrl('https://www.jumbo.cl/api/checkout/pub/orderForm/abc/transaction'), true);
  });

  it('una conexión pendiente (sin sesión) no llena el carro', async () => {
    const repo: StoreRepo = {
      getCart: async () => ({ id: 'c1', storeSlug: 'jumbo', status: 'approved' }),
      getApprovedItems: async () => [{ id: 'i1', name: 'Leche', quantity: 1, payable: 1000, canonicalProductId: null }],
      findListingUrl: async () => null,
      getConnection: async () => ({ encryptedSession: '', status: 'pending' }),
      saveConnection: async () => undefined,
      saveFill: async () => 'f1',
      markCartFilled: async () => undefined,
    };
    let opened = false;
    await assert.rejects(
      fillCart('fam-a', 'c1', {
        repo,
        createAdapter: async () => {
          opened = true;
          throw new Error('no debería abrir el navegador');
        },
      }),
      StoreToolError,
    );
    assert.equal(opened, false);
  });
});
