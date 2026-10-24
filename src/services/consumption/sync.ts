/**
 * Pasa las compras nuevas al perfil, de a una.
 * El cron diario proyecta el stock. El semanal arma un carro.
 * Nadie paga ni hace el pedido.
 */

import { prisma } from '@/lib/prisma';
import { productIdentity } from '../catalog/normalize';
import { bundleCart, BundleItem, BundleOffer, STORE_LEAD_DAYS } from './bundle';
import {
  applyFeedback,
  applyPurchase,
  baseAmountFromCatalog,
  coldStartRate,
  coverageOf,
  emptyProfile,
  FeedbackKind,
  householdEquivalents,
  householdGroupKey,
  priorFor,
  ProfileState,
  HouseholdEventWindow,
} from './predict';

const BUTCHER = /lomo vetado|lomo liso|entraña|entrana|asado de tira|posta|plateada|filete|osobuco|paleta|chuleta|costillar|molida|punta de ganso/i;

function asCounts(raw: string | null | undefined): number[] {
  const empty = Array.from({ length: 12 }, () => 0);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 12) return empty;
    return parsed.map((value) => Number(value) || 0);
  } catch {
    return empty;
  }
}

function toState(row: {
  ratePerDay: number;
  rateVar: number;
  rateMedian: number;
  rateMad: number;
  avgInterval: number | null;
  nPurchases: number;
  nIntervals: number;
  lastPurchaseAt: Date | null;
  lastAmount: number;
  leftover: number;
  estStock: number;
  stockAnchoredAt: Date | null;
  confidence: string;
  frozen: boolean;
  seasonFactor: number;
  monthCounts: string | null;
  group?: { defaultBaseUnit: string };
}): ProfileState {
  return {
    ratePerDay: row.ratePerDay,
    rateVar: row.rateVar,
    rateMedian: row.rateMedian,
    rateMad: row.rateMad,
    avgInterval: row.avgInterval || 0,
    nPurchases: row.nPurchases,
    nIntervals: row.nIntervals,
    lastPurchaseAt: row.lastPurchaseAt ? row.lastPurchaseAt.toISOString() : null,
    lastAmount: row.lastAmount,
    leftover: row.leftover,
    estStock: row.estStock,
    stockAnchoredAt: row.stockAnchoredAt ? row.stockAnchoredAt.toISOString() : null,
    confidence: (row.confidence as ProfileState['confidence']) || 'baja',
    frozen: row.frozen,
    seasonFactor: row.seasonFactor || 1,
    monthCounts: asCounts(row.monthCounts),
    unit: (row.group?.defaultBaseUnit as ProfileState['unit']) || 'un',
  };
}

function fromState(state: ProfileState, coverage: ReturnType<typeof coverageOf>) {
  return {
    ratePerDay: state.ratePerDay,
    rateVar: state.rateVar,
    rateMedian: state.rateMedian,
    rateMad: state.rateMad,
    avgInterval: state.avgInterval || null,
    nPurchases: state.nPurchases,
    nIntervals: state.nIntervals,
    lastPurchaseAt: state.lastPurchaseAt ? new Date(state.lastPurchaseAt) : null,
    lastAmount: state.lastAmount,
    leftover: state.leftover,
    estStock: state.estStock,
    stockAnchoredAt: state.stockAnchoredAt ? new Date(state.stockAnchoredAt) : null,
    confidence: coverage?.confidence || state.confidence,
    frozen: state.frozen,
    seasonFactor: state.seasonFactor,
    monthCounts: JSON.stringify(state.monthCounts),
    runOutAt: coverage ? coverage.runOut : null,
    bandEarly: coverage ? coverage.early : null,
    bandLate: coverage ? coverage.late : null,
  };
}

async function familyContext(userId: string) {
  const membership = await prisma.familyMember.findFirst({
    where: { userId, isActive: true },
    include: {
      family: {
        include: {
          members: { where: { isActive: true } },
          events: { where: { isActive: true } },
        },
      },
    },
  });
  if (!membership) return null;
  const events: HouseholdEventWindow[] = membership.family.events.map((event) => ({
    multiplier: event.multiplier,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    month: event.month,
    day: event.day,
    isActive: event.isActive,
  }));
  return {
    familyId: membership.familyId,
    equivalents: householdEquivalents(membership.family.members),
    events,
  };
}

export async function applyPendingPurchases(now = new Date()): Promise<{ applied: number; waiting: number }> {
  const pending = await prisma.purchaseHistory.findMany({
    where: { appliedAt: null },
    orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
    take: 500,
  });
  const canonicals = await prisma.canonicalProduct.findMany({
    select: { id: true, name: true, sizeAmount: true, sizeUnit: true, packCount: true, soldByWeight: true },
  });
  const byIdentity = new Map(canonicals.map((row) => [productIdentity(row.name), row]));
  let applied = 0;
  let waiting = 0;

  for (const row of pending) {
    const lookedUp = await familyContext(row.userId);
    const context = lookedUp
      ? { ...lookedUp, familyId: row.familyId || lookedUp.familyId }
      : row.familyId
        ? { familyId: row.familyId, equivalents: 1, events: [] as HouseholdEventWindow[] }
        : null;
    const canonical = row.canonicalProductId
      ? canonicals.find((item) => item.id === row.canonicalProductId) || null
      : byIdentity.get(productIdentity(row.productName)) || null;
    const measured = baseAmountFromCatalog(row.quantity, row.unit, row.productName, canonical);
    const groupKey = row.groupKey || householdGroupKey(row.productName);
    const prior = priorFor(row.productName);
    if (!context) {
      if (row.baseAmount == null || !row.groupKey) {
        await prisma.purchaseHistory.update({
          where: { id: row.id },
          data: {
            baseAmount: measured.baseAmount,
            baseUnit: measured.baseUnit,
            groupKey,
            canonicalProductId: canonical?.id || row.canonicalProductId,
          },
        });
      }
      waiting += 1;
      continue;
    }
    const group = await prisma.productGroup.upsert({
      where: { familyKey: groupKey },
      update: {},
      create: {
        familyKey: groupKey,
        category: prior.category,
        defaultBaseUnit: measured.baseUnit,
        priorPerPersonDay: prior.perPersonDay,
      },
    });
    await prisma.$transaction(async (tx) => {
      const current = await tx.purchaseHistory.findUnique({ where: { id: row.id }, select: { appliedAt: true } });
      if (!current || current.appliedAt) return;
      const existing = await tx.consumptionProfile.findUnique({
        where: { familyId_groupId: { familyId: context.familyId, groupId: group.id } },
        include: { group: true },
      });
      const state = existing ? toState(existing) : emptyProfile(measured.baseUnit);
      state.unit = measured.baseUnit;
      const next = applyPurchase(state, { at: row.purchasedAt, amount: measured.baseAmount });
      const coverage = coverageOf(next, now, {
        priorPerDay: coldStartRate(group.priorPerPersonDay, context.equivalents),
        events: context.events,
        leadDays: STORE_LEAD_DAYS[row.storeName || ''] || 2,
      });
      const data = fromState(next, coverage);
      if (existing) {
        await tx.consumptionProfile.update({ where: { id: existing.id }, data });
      } else {
        await tx.consumptionProfile.create({
          data: { familyId: context.familyId, groupId: group.id, ...data },
        });
      }
      await tx.purchaseHistory.update({
        where: { id: row.id },
        data: {
          familyId: context.familyId,
          canonicalProductId: canonical?.id || row.canonicalProductId,
          groupKey,
          baseAmount: measured.baseAmount,
          baseUnit: measured.baseUnit,
          appliedAt: now,
        },
      });
    });
    applied += 1;
  }
  return { applied, waiting };
}

export async function refreshProfiles(now = new Date()): Promise<{ opened: number; dismissed: number }> {
  const profiles = await prisma.consumptionProfile.findMany({ include: { group: true, family: { include: { members: true, events: true } } } });
  let opened = 0;
  let dismissed = 0;
  for (const profile of profiles) {
    const events: HouseholdEventWindow[] = profile.family.events.filter((event) => event.isActive).map((event) => ({
      multiplier: event.multiplier,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      month: event.month,
      day: event.day,
      isActive: event.isActive,
    }));
    const state = toState(profile);
    const coverage = coverageOf(state, now, {
      priorPerDay: coldStartRate(profile.group.priorPerPersonDay, householdEquivalents(profile.family.members)),
      events,
      leadDays: 2,
    });
    await prisma.consumptionProfile.update({
      where: { id: profile.id },
      data: {
        runOutAt: coverage?.runOut || null,
        bandEarly: coverage?.early || null,
        bandLate: coverage?.late || null,
        confidence: coverage?.confidence || state.confidence,
      },
    });
    const open = await prisma.replenishmentAlert.findFirst({
      where: { familyId: profile.familyId, groupId: profile.groupId, status: { in: ['open', 'snoozed', 'proposed'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (profile.frozen || !coverage?.alert) {
      if (open && open.status === 'open') {
        await prisma.replenishmentAlert.update({ where: { id: open.id }, data: { status: 'dismissed' } });
        dismissed += 1;
      }
      continue;
    }
    const days = Math.max(0, Math.round(coverage.daysLeft));
    const message = `Se acaba en ~${days} ${days === 1 ? 'día' : 'días'}. Confianza ${coverage.confidence}.`;
    if (open && open.status !== 'proposed') {
      await prisma.replenishmentAlert.update({
        where: { id: open.id },
        data: {
          status: 'open',
          predictedRunOut: coverage.runOut,
          bandEarly: coverage.early,
          bandLate: coverage.late,
          message,
        },
      });
    } else if (!open) {
      await prisma.replenishmentAlert.create({
        data: {
          familyId: profile.familyId,
          groupId: profile.groupId,
          status: 'open',
          predictedRunOut: coverage.runOut,
          bandEarly: coverage.early,
          bandLate: coverage.late,
          message,
        },
      });
      opened += 1;
    }
  }
  return { opened, dismissed };
}

function offerFromObservation(row: { productName: string; storeName: string; price: number; inStock: boolean }): { groupKey: string; offer: BundleOffer } | null {
  const groupKey = householdGroupKey(row.productName);
  const openWeight = BUTCHER.test(row.productName) && !/\d/.test(row.productName);
  if (openWeight && row.storeName.toLowerCase() === 'tottus') {
    return {
      groupKey,
      offer: { store: row.storeName, name: row.productName, pricePerUnit: row.price, inStock: row.inStock, minPurchase: 1.5, step: 0.5 },
    };
  }
  const base = baseAmountFromCatalog(1, null, row.productName, null);
  if (base.baseAmount <= 0) return null;
  return {
    groupKey,
    offer: { store: row.storeName, name: row.productName, pricePerUnit: Math.round(row.price / base.baseAmount), inStock: row.inStock },
  };
}

export async function proposeWeeklyCarts(now = new Date()): Promise<{ carts: number }> {
  const since = new Date(now.getTime() - 6 * 86_400_000);
  const profiles = await prisma.consumptionProfile.findMany({
    where: { frozen: false, runOutAt: { not: null } },
    include: { group: true },
  });
  const observations = await prisma.priceObservation.findMany({ orderBy: { observedAt: 'desc' }, take: 400 });
  const offersByGroup = new Map<string, BundleOffer[]>();
  for (const row of observations) {
    const built = offerFromObservation(row);
    if (!built) continue;
    const list = offersByGroup.get(built.groupKey) || [];
    if (list.some((offer) => offer.store === built.offer.store)) continue;
    list.push(built.offer);
    offersByGroup.set(built.groupKey, list);
  }

  const byFamily = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const list = byFamily.get(profile.familyId) || [];
    list.push(profile);
    byFamily.set(profile.familyId, list);
  }

  let carts = 0;
  for (const [familyId, rows] of byFamily) {
    const recent = await prisma.proposedCart.findFirst({
      where: { familyId, status: 'proposed', createdAt: { gte: since } },
    });
    if (recent) continue;
    const items: BundleItem[] = [];
    for (const profile of rows) {
      if (!profile.runOutAt) continue;
      const offers = offersByGroup.get(profile.group.familyKey) || [];
      if (!offers.length) continue;
      const quantity = Math.max(profile.lastAmount, profile.ratePerDay * 7, 1);
      items.push({
        groupKey: profile.group.familyKey,
        name: profile.group.familyKey,
        runOutAt: profile.runOutAt,
        quantity: Math.round(quantity * 10) / 10,
        unit: profile.group.defaultBaseUnit,
        offers,
      });
    }
    const proposal = bundleCart(items, { now, leadDays: 2, bufferDays: 2 });
    if (!proposal) continue;
    const cart = await prisma.proposedCart.create({
      data: {
        familyId,
        storeSlug: proposal.store.toLowerCase().replace(/\s+/g, '-'),
        storeName: proposal.store,
        status: 'proposed',
        subtotal: proposal.subtotal,
        delivery: proposal.delivery,
        total: proposal.total,
        minOrder: proposal.minOrder,
        meetsMinimum: proposal.meetsMinimum,
        note: proposal.note,
        items: {
          create: proposal.items.map((item) => ({
            groupId: rows.find((row) => row.group.familyKey === item.groupKey)?.groupId,
            name: item.name,
            quantity: item.bought,
            unit: item.unit,
            payable: item.payable,
            runOutAt: rows.find((row) => row.group.familyKey === item.groupKey)?.runOutAt,
            pulledForward: item.pulledForward,
          })),
        },
      },
    });
    const groupIds = rows
      .filter((row) => proposal.items.some((item) => item.groupKey === row.group.familyKey))
      .map((row) => row.groupId);
    await prisma.replenishmentAlert.updateMany({
      where: { familyId, status: 'open', groupId: { in: groupIds } },
      data: { status: 'proposed', cartId: cart.id },
    });
    carts += 1;
  }
  return { carts };
}

export async function approveProposedCart(cartId: string, userId: string) {
  const cart = await prisma.proposedCart.findUnique({ where: { id: cartId } });
  if (!cart) {
    const error = new Error('No encontré el carro') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
  const member = await prisma.familyMember.findFirst({
    where: { userId, familyId: cart.familyId, isActive: true },
  });
  if (!member || member.role !== 'master') {
    const error = new Error('Solo quien administra la familia puede aprobar el carro') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
  if (cart.status !== 'proposed') return cart;
  return prisma.proposedCart.update({
    where: { id: cartId },
    data: { status: 'approved', note: 'Aprobado por la familia. AVI no pagó ni hizo el pedido.' },
  });
}

export async function recordAlertFeedback(input: {
  alertId: string;
  userId: string;
  kind: FeedbackKind;
  stockReported?: number | null;
}) {
  const alert = await prisma.replenishmentAlert.findUnique({ where: { id: input.alertId } });
  if (!alert) {
    const error = new Error('No encontré el aviso') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
  const member = await prisma.familyMember.findFirst({
    where: { userId: input.userId, familyId: alert.familyId, isActive: true },
  });
  if (!member) {
    const error = new Error('No perteneces a esta familia') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
  const profile = await prisma.consumptionProfile.findUnique({
    where: { familyId_groupId: { familyId: alert.familyId, groupId: alert.groupId } },
    include: { group: true },
  });
  if (!profile) {
    const error = new Error('No hay un perfil para este producto') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }
  const next = applyFeedback(toState(profile), { kind: input.kind, stockReported: input.stockReported, at: new Date() });
  const coverage = coverageOf(next, new Date(), { priorPerDay: profile.group.priorPerPersonDay });
  await prisma.$transaction([
    prisma.alertFeedback.create({
      data: {
        alertId: alert.id,
        memberId: member.id,
        kind: input.kind,
        stockReported: input.stockReported ?? null,
      },
    }),
    prisma.consumptionProfile.update({ where: { id: profile.id }, data: fromState(next, coverage) }),
    prisma.replenishmentAlert.update({
      where: { id: alert.id },
      data: { status: next.frozen ? 'dismissed' : input.kind === 'ya_tengo' ? 'snoozed' : alert.status },
    }),
  ]);
  return { frozen: next.frozen, estStock: next.estStock, ratePerDay: next.ratePerDay };
}
