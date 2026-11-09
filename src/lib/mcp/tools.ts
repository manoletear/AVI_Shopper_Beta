import { prisma } from '@/lib/prisma';
import { parseBasicState } from '@/lib/onboarding/basic';
import { checkAllergens } from '@/lib/nutrition/check-allergens';
import { callStoreWorker, StoreWorkerError } from '@/lib/stores/remote';
import { notifyCartProposed } from '@/lib/notifications/cart-proposed';
import { isApprover } from '@/lib/family/approver';
import { getHouseholdIntelligence } from '@/services/consumption/household-intelligence';
import type { WorkerJob } from '@/lib/stores/worker';
import type { AllergenCheckResult, MemberAllergies, StoreName } from '@/types/nutrition';
import type {
  HouseholdResult,
  LockedProduct,
  PantryItem,
  ProposeCartInput,
  ProposedCartResult,
} from '@/types/mcp';

/**
 * Herramientas del MCP de AVI. El familyId siempre viene del token.
 * AVI propone, la familia decide: nada de esto paga ni hace checkout.
 */

export class McpToolError extends Error {}

const STORE_LABELS: Record<StoreName, string> = {
  jumbo: 'Jumbo',
  lider: 'Lider',
  unimarc: 'Unimarc',
  tottus: 'Tottus',
};

/** family_members.allergies es texto con un arreglo JSON. */
export function parseMemberAllergies(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// Re-export para mantener compatibilidad con imports existentes.
export { isApprover } from '@/lib/family/approver';

export function payableFor(quantity: number, unitPriceClp: number | undefined): number {
  if (unitPriceClp == null) return 0;
  return Math.round(quantity * unitPriceClp);
}

async function activeMembers(familyId: string) {
  return prisma.familyMember.findMany({
    where: { familyId, isActive: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
}

async function familyAllergies(familyId: string): Promise<MemberAllergies[]> {
  const members = await activeMembers(familyId);
  return members
    .map((member) => ({ id: member.id, name: member.name, allergens: parseMemberAllergies(member.allergies) }))
    .filter((member) => member.allergens.length > 0);
}

export async function getHousehold(familyId: string): Promise<HouseholdResult> {
  const family = await prisma.family.findUnique({ where: { id: familyId }, include: { settings: true } });
  if (!family) throw new McpToolError('No encontré la familia de este token');
  const members = await activeMembers(familyId);
  const rows = members.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    type: member.type,
    allergies: parseMemberAllergies(member.allergies),
    dietType: member.dietType,
    dietTags: member.dietTags,
    ageRange: member.ageRange,
    isApprover: isApprover(member, family.settings),
  }));
  return {
    familyId: family.id,
    familyName: family.name,
    approverMemberIds: rows.filter((row) => row.isApprover).map((row) => row.id),
    members: rows,
    hasPets: rows.some((row) => row.type === 'pet') || Boolean(family.settings?.includesPet),
  };
}

/**
 * Productos fijos: preferencias de integrante con un producto canónico elegido
 * (member_preferences.preferredCanonicalId, avoid = false).
 */
export async function getLockedProducts(familyId: string): Promise<LockedProduct[]> {
  const prefs = await prisma.memberPreference.findMany({
    where: { avoid: false, preferredCanonicalId: { not: null }, member: { familyId, isActive: true } },
    include: { member: true, group: true, preferredCanonical: true },
    orderBy: { updatedAt: 'desc' },
  });
  return prefs
    .filter((pref) => pref.preferredCanonical)
    .map((pref) => {
      const product = pref.preferredCanonical!;
      const format = product.sizeAmount ? `${product.sizeAmount} ${product.sizeUnit ?? ''}`.trim() : null;
      return {
        memberId: pref.memberId,
        memberName: pref.member.name,
        group: pref.group.familyKey,
        canonicalProductId: product.id,
        name: product.name,
        brand: product.brand,
        format,
      };
    });
}

/** Advierte por integrante (contiene / puede contener). Nunca bloquea. */
export async function checkAllergensForFamily(
  familyId: string,
  productNutritionId: string,
): Promise<AllergenCheckResult> {
  return checkAllergens(productNutritionId, await familyAllergies(familyId));
}

export async function proposeCart(familyId: string, input: ProposeCartInput): Promise<ProposedCartResult> {
  const family = await prisma.family.findUnique({ where: { id: familyId }, select: { id: true } });
  if (!family) throw new McpToolError('No encontré la familia de este token');

  const members = await familyAllergies(familyId);
  const checks = await Promise.all(
    input.items.map((item) => (item.productNutritionId ? checkAllergens(item.productNutritionId, members) : null)),
  );
  const payables = input.items.map((item) => payableFor(item.quantity, item.unitPriceClp));
  const subtotal = payables.reduce((sum, value) => sum + value, 0);
  const warned = checks.filter((check) => check?.warnings.length).length;
  const note = [
    input.note,
    warned ? `${warned} producto(s) con aviso de alérgenos: requieren aprobación.` : null,
    'AVI propone, la familia decide. AVI no paga ni hace el pedido.',
  ]
    .filter(Boolean)
    .join(' ');

  const { cart, rows } = await prisma.$transaction(async (tx) => {
    const created = await tx.proposedCart.create({
      data: {
        familyId,
        storeSlug: input.store,
        storeName: STORE_LABELS[input.store],
        status: 'proposed',
        subtotal,
        total: subtotal,
        note,
      },
    });
    const createdRows = [];
    for (const [index, item] of input.items.entries()) {
      createdRows.push(
        await tx.proposedCartItem.create({
          data: {
            cartId: created.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            payable: payables[index],
            canonicalProductId: item.canonicalProductId,
          },
        }),
      );
    }
    return { cart: created, rows: createdRows };
  });

  const items = rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    payable: row.payable,
    allergenCheck: checks[index],
  }));

  // Await: notifyCartProposed tiene try/catch interno, nunca falla el carro.
  await notifyCartProposed({
    cartId: cart.id,
    familyId,
    storeName: cart.storeName,
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, payable: i.payable })),
    subtotal,
    allergenChecks: checks,
    note: note || undefined,
  });

  return {
    cartId: cart.id,
    store: cart.storeName,
    status: 'proposed',
    subtotal,
    items,
    requiresApproval: true,
  };
}

async function requireApprover(familyId: string, cartId: string, approverMemberId: string) {
  const cart = await prisma.proposedCart.findFirst({ where: { id: cartId, familyId } });
  if (!cart) throw new McpToolError('No encontré ese carro en esta familia');
  const member = await prisma.familyMember.findFirst({
    where: { id: approverMemberId, familyId, isActive: true },
  });
  const settings = await prisma.familySettings.findUnique({ where: { familyId } });
  if (!member || !isApprover(member, settings)) {
    throw new McpToolError('Solo quien aprueba el carro de la familia puede hacerlo');
  }
  return cart;
}

export async function approveItem(
  familyId: string,
  input: { cartId: string; itemId: string; approverMemberId: string; approved: boolean },
) {
  const cart = await requireApprover(familyId, input.cartId, input.approverMemberId);
  if (cart.status !== 'proposed') throw new McpToolError(`El carro ya está en estado "${cart.status}"`);
  const updated = await prisma.proposedCartItem.updateMany({
    where: { id: input.itemId, cartId: cart.id },
    data: { approved: input.approved },
  });
  if (updated.count === 0) throw new McpToolError('No encontré ese ítem en el carro');
  return { itemId: input.itemId, approved: input.approved };
}

export async function approveCart(
  familyId: string,
  input: { cartId: string; approverMemberId: string; approvePending: boolean },
) {
  const cart = await requireApprover(familyId, input.cartId, input.approverMemberId);
  if (cart.status !== 'proposed') return { cartId: cart.id, status: cart.status };

  if (input.approvePending) {
    await prisma.proposedCartItem.updateMany({ where: { cartId: cart.id, approved: null }, data: { approved: true } });
  } else {
    const pending = await prisma.proposedCartItem.count({ where: { cartId: cart.id, approved: null } });
    if (pending > 0) {
      throw new McpToolError(`Hay ${pending} ítem(s) sin decidir. Apruébalos o recházalos, o usa approvePending.`);
    }
  }

  const approved = await prisma.proposedCartItem.findMany({ where: { cartId: cart.id, approved: true } });
  const subtotal = approved.reduce((sum, item) => sum + item.payable, 0);
  const result = await prisma.proposedCart.update({
    where: { id: cart.id },
    data: {
      status: 'approved',
      subtotal,
      total: subtotal + cart.delivery,
      note: 'Aprobado por la familia. AVI no pagó ni hizo el pedido.',
    },
  });
  return { cartId: result.id, status: result.status, total: result.total, approvedItems: approved.length };
}

/**
 * Despensa inteligente: stock estimado, días restantes, semáforo,
 * consumo por persona/día según contexto (colación, cotidiano, asado).
 * Se auto-actualiza con cada compra.
 */
export async function getPantry(familyId: string) {
  return getHouseholdIntelligence(familyId);
}

/**
 * Llenar el carro real y ver despacho: delegan al worker de tiendas (Playwright).
 * Solo carros aprobados por el aprobador; se detiene en el carro lleno. Nunca paga.
 */
async function viaWorker(job: WorkerJob): Promise<unknown> {
  try {
    return await callStoreWorker(job);
  } catch (error) {
    if (error instanceof StoreWorkerError) throw new McpToolError(error.message);
    throw error;
  }
}

export async function fillStoreCart(familyId: string, cartId: string) {
  const cart = await prisma.proposedCart.findFirst({ where: { id: cartId, familyId }, select: { status: true } });
  if (!cart) throw new McpToolError('No encontré ese carro en esta familia');
  if (cart.status !== 'approved') {
    throw new McpToolError(`El carro debe estar aprobado por quien aprueba en la familia (estado: "${cart.status}")`);
  }
  return viaWorker({ op: 'fill_cart', familyId, cartId });
}

export async function getStoreDeliveryWindows(
  familyId: string,
  input: { store: StoreName; street?: string; number?: string; comuna?: string },
) {
  let address = input.street ? { street: input.street, number: input.number, comuna: input.comuna } : null;
  if (!address) {
    const primary = await prisma.familyAddress.findFirst({
      where: { familyId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    if (!primary) throw new McpToolError('La familia no tiene dirección de despacho');
    address = { street: primary.street, number: primary.number || undefined, comuna: primary.comuna };
  }
  return viaWorker({ op: 'get_delivery_windows', familyId, store: input.store, address });
}

export async function getPurchaseHistory(
  familyId: string,
  opts: { limit?: number; storeSlug?: string; from?: string; to?: string } = {},
) {
  const limit = Math.min(opts.limit || 50, 200);
  const where: any = { familyId };
  if (opts.storeSlug) where.storeSlug = opts.storeSlug;
  if (opts.from || opts.to) {
    where.purchasedAt = {};
    if (opts.from) where.purchasedAt.gte = new Date(opts.from);
    if (opts.to) where.purchasedAt.lte = new Date(opts.to);
  }

  const rows = await prisma.purchaseHistory.findMany({
    where,
    orderBy: { purchasedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      productName: true,
      brand: true,
      storeSlug: true,
      storeName: true,
      quantity: true,
      unit: true,
      price: true,
      purchasedAt: true,
      source: true,
      appliedAt: true,
      groupKey: true,
      canonicalProductId: true,
    },
  });

  return {
    familyId,
    count: rows.length,
    purchases: rows.map((r) => ({
      ...r,
      purchasedAt: r.purchasedAt.toISOString(),
      appliedAt: r.appliedAt?.toISOString() ?? null,
      applied: !!r.appliedAt,
    })),
  };
}

export async function connectStoreForFamily(
  familyId: string,
  input: { store: StoreName; email: string; password: string },
) {
  return viaWorker({
    op: 'connect_store',
    familyId,
    store: input.store,
    credentials: { email: input.email, password: input.password },
  });
}

export async function getStoreConnectionStatus(familyId: string) {
  const connections = await prisma.storeConnection.findMany({
    where: { familyId },
    select: { storeSlug: true, status: true, lastVerifiedAt: true, updatedAt: true },
    orderBy: { storeSlug: 'asc' },
  });
  const allStores: StoreName[] = ['jumbo', 'lider', 'unimarc', 'tottus'];
  return allStores.map((slug) => {
    const conn = connections.find((c) => c.storeSlug === slug);
    return {
      store: slug,
      storeName: STORE_LABELS[slug],
      connected: !!conn,
      status: conn?.status ?? 'not_connected',
      lastVerifiedAt: conn?.lastVerifiedAt?.toISOString() ?? null,
    };
  });
}
