/**
 * Modelo de predicción basado en ciclos de Gran Compra.
 *
 * La familia compra en dos modos:
 * - Gran Compra: semanal/quincenal, el grueso del hogar (≥$50K o ≥15 items)
 * - Complementaria: cosas puntuales, antojos, lo que faltó
 *
 * Para predecir reposición usamos los ciclos de Gran Compra:
 * qué productos aparecen en cada una, con qué frecuencia, y cuándo toca la próxima.
 *
 * También estima las calorías diarias del hogar desde las compras.
 */

import { prisma } from '@/lib/prisma';

const BIG_SHOP_MIN_TOTAL = 50000;
const BIG_SHOP_MIN_ITEMS = 15;
const RECENT_CYCLES = 10;

interface OrderSummary {
  orderRef: string;
  userId: string;
  date: Date;
  itemCount: number;
  total: number;
  type: 'gran_compra' | 'complementaria';
  groupKeys: string[];
}

export interface CycleStat {
  groupKey: string;
  category: string | null;
  cycleRate: number;
  lastSeenCyclesAgo: number;
  avgQuantity: number;
  typicalStore: string | null;
  urgency: number;
  lastPurchasedAt: string | null;
}

export interface BuyerCycle {
  userId: string;
  userName: string | null;
  totalOrders: number;
  granCompras: number;
  medianIntervalDays: number;
  lastGranCompra: string | null;
  nextPredicted: string | null;
  confidence: 'alta' | 'media' | 'baja';
}

export interface HouseholdCalories {
  dailyKcalEstimate: number;
  weeklySpendClp: number;
  topCalorieSources: { group: string; kcalPerWeek: number; pctOfTotal: number }[];
  dataWindowDays: number;
}

export interface GranCompraForecast {
  buyers: BuyerCycle[];
  nextGranCompra: { buyer: string; date: string; daysFromNow: number } | null;
  mustBuy: CycleStat[];
  shouldBuy: CycleStat[];
  optional: CycleStat[];
  calories: HouseholdCalories;
  totalProducts: number;
  analyzedOrders: number;
}

async function getOrderSummaries(familyId: string): Promise<OrderSummary[]> {
  const rows = await prisma.purchaseHistory.findMany({
    where: { familyId },
    select: {
      orderRef: true,
      userId: true,
      purchasedAt: true,
      price: true,
      quantity: true,
      groupKey: true,
      category: true,
      storeSlug: true,
      storeName: true,
    },
    orderBy: { purchasedAt: 'asc' },
  });

  const byOrder = new Map<string, {
    userId: string;
    date: Date;
    items: { groupKey: string; price: number; quantity: number; store: string }[];
  }>();

  for (const r of rows) {
    const ref = r.orderRef || `solo-${r.purchasedAt.toISOString()}`;
    if (!byOrder.has(ref)) {
      byOrder.set(ref, { userId: r.userId, date: r.purchasedAt, items: [] });
    }
    byOrder.get(ref)!.items.push({
      groupKey: r.groupKey || 'unknown',
      price: (r.price ?? 0) * (r.quantity ?? 1),
      quantity: r.quantity ?? 1,
      store: r.storeSlug || r.storeName || '',
    });
  }

  const orders: OrderSummary[] = [];
  for (const [orderRef, o] of byOrder) {
    const total = o.items.reduce((s, i) => s + i.price, 0);
    const type = total >= BIG_SHOP_MIN_TOTAL || o.items.length >= BIG_SHOP_MIN_ITEMS
      ? 'gran_compra' : 'complementaria';
    orders.push({
      orderRef,
      userId: o.userId,
      date: o.date,
      itemCount: o.items.length,
      total,
      type,
      groupKeys: [...new Set(o.items.map((i) => i.groupKey))],
    });
  }

  return orders.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buyerCycles(orders: OrderSummary[], familyMembers: { userId: string | null; name: string }[]): BuyerCycle[] {
  const byBuyer = new Map<string, OrderSummary[]>();
  for (const o of orders) {
    if (!byBuyer.has(o.userId)) byBuyer.set(o.userId, []);
    byBuyer.get(o.userId)!.push(o);
  }

  const result: BuyerCycle[] = [];
  for (const [userId, userOrders] of byBuyer) {
    const big = userOrders.filter((o) => o.type === 'gran_compra');
    const intervals: number[] = [];
    for (let i = 1; i < big.length; i++) {
      const days = Math.round((big[i].date.getTime() - big[i - 1].date.getTime()) / 86400000);
      if (days > 0) intervals.push(days);
    }
    const med = median(intervals);
    const last = big.length > 0 ? big[big.length - 1].date : null;
    const next = last && med > 0 ? new Date(last.getTime() + med * 86400000) : null;
    const member = familyMembers.find((m) => m.userId === userId);

    result.push({
      userId,
      userName: member?.name ?? null,
      totalOrders: userOrders.length,
      granCompras: big.length,
      medianIntervalDays: med,
      lastGranCompra: last?.toISOString() ?? null,
      nextPredicted: next?.toISOString() ?? null,
      confidence: big.length >= 6 ? 'alta' : big.length >= 3 ? 'media' : 'baja',
    });
  }

  return result;
}

function productCycleStats(orders: OrderSummary[], familyId: string): CycleStat[] {
  const bigOrders = orders.filter((o) => o.type === 'gran_compra');
  const recent = bigOrders.slice(-RECENT_CYCLES);
  if (recent.length === 0) return [];

  const allPurchases = new Map<string, { dates: Date[]; quantities: number[]; stores: string[]; category: string | null }>();

  // Collect per-product data from all orders
  // (we need full history for quantities and stores, but cycle rate uses recent only)
  for (const o of orders) {
    for (const gk of o.groupKeys) {
      if (!allPurchases.has(gk)) allPurchases.set(gk, { dates: [], quantities: [], stores: [], category: null });
    }
  }

  // Detailed data from purchase_history would be better, but we work with order summaries
  // For now, use the groupKeys presence in each order

  const stats: CycleStat[] = [];
  const recentRefs = new Set(recent.map((o) => o.orderRef));

  for (const [gk, data] of allPurchases) {
    const inRecentCycles = recent.filter((o) => o.groupKeys.includes(gk)).length;
    const cycleRate = inRecentCycles / recent.length;

    // How many cycles ago was it last seen?
    let lastSeenCyclesAgo = recent.length;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].groupKeys.includes(gk)) {
        lastSeenCyclesAgo = recent.length - 1 - i;
        break;
      }
    }

    // Last purchase date (from any order type)
    let lastDate: Date | null = null;
    for (let i = orders.length - 1; i >= 0; i--) {
      if (orders[i].groupKeys.includes(gk)) {
        lastDate = orders[i].date;
        break;
      }
    }

    // Typical store from big orders
    const storesInBig = bigOrders
      .filter((o) => o.groupKeys.includes(gk))
      .map((o) => {
        // Approximate: use first item's store or order-level store
        return '';
      });

    const urgency = cycleRate * (1 + lastSeenCyclesAgo * 0.3);

    stats.push({
      groupKey: gk,
      category: null,
      cycleRate,
      lastSeenCyclesAgo,
      avgQuantity: 1,
      typicalStore: null,
      urgency,
      lastPurchasedAt: lastDate?.toISOString() ?? null,
    });
  }

  return stats.sort((a, b) => b.urgency - a.urgency);
}

async function estimateCalories(familyId: string): Promise<HouseholdCalories> {
  // Get purchases from the last 90 days
  const since = new Date(Date.now() - 90 * 86400000);
  const purchases = await prisma.purchaseHistory.findMany({
    where: { familyId, purchasedAt: { gte: since } },
    select: { groupKey: true, quantity: true, baseAmount: true, baseUnit: true, purchasedAt: true, price: true },
  });

  if (purchases.length === 0) {
    return { dailyKcalEstimate: 0, weeklySpendClp: 0, topCalorieSources: [], dataWindowDays: 0 };
  }

  const earliest = purchases.reduce((min, p) => p.purchasedAt < min ? p.purchasedAt : min, purchases[0].purchasedAt);
  const dataWindowDays = Math.max(1, Math.round((Date.now() - earliest.getTime()) / 86400000));

  // Calorie estimates per category (rough kcal per typical unit purchased)
  const KCAL_PER_UNIT: Record<string, number> = {
    arroz: 3500, pan_molde: 1200, pan_marraqueta_hallulla: 900, pasta: 3500,
    huevos: 900, leche_entera: 600, leche_chocolate: 500, leche_cultivada: 400,
    yoghurt: 500, queso_gauda_laminado: 1800, queso_mozzarella: 1500, queso_otro: 1500,
    mantequilla: 1800, aceite: 8000,
    pollo_trutro: 2000, carne_asado: 2500, carne_molida: 2000, cerdo: 2200,
    pescado_marisco: 1000, longaniza: 1500,
    coca_cola_zero_1_5l: 5, jugo_nectar_familiar: 400,
    palta: 800, tomate: 100, cebolla: 200, zanahoria: 200, brocoli: 150, lechuga: 50,
    platano: 400, manzana: 250, uva: 300, arandano: 200,
    galletas: 2000, dulces_chocolates: 2500, snack_salado: 2500, frutos_secos: 3000,
    papas_prefritas: 2500, choclo: 1000,
    pechuga_pavo: 800, jamon: 1200, jamon_serrano: 1500,
  };

  const byGroup = new Map<string, { totalKcal: number; totalSpend: number }>();
  let totalKcal = 0;
  let totalSpend = 0;

  for (const p of purchases) {
    const gk = p.groupKey || 'unknown';
    const qty = p.quantity ?? 1;
    const kcalPerUnit = KCAL_PER_UNIT[gk] || 500;
    const kcal = kcalPerUnit * qty;
    const spend = (p.price ?? 0) * qty;

    totalKcal += kcal;
    totalSpend += spend;

    if (!byGroup.has(gk)) byGroup.set(gk, { totalKcal: 0, totalSpend: 0 });
    const g = byGroup.get(gk)!;
    g.totalKcal += kcal;
    g.totalSpend += spend;
  }

  const dailyKcal = Math.round(totalKcal / dataWindowDays);
  const weeklySpend = Math.round(totalSpend / dataWindowDays * 7);

  const topSources = [...byGroup.entries()]
    .map(([group, d]) => ({
      group,
      kcalPerWeek: Math.round(d.totalKcal / dataWindowDays * 7),
      pctOfTotal: totalKcal > 0 ? Math.round(d.totalKcal / totalKcal * 100) : 0,
    }))
    .filter((s) => s.pctOfTotal >= 2)
    .sort((a, b) => b.kcalPerWeek - a.kcalPerWeek)
    .slice(0, 10);

  return { dailyKcalEstimate: dailyKcal, weeklySpendClp: weeklySpend, topCalorieSources: topSources, dataWindowDays };
}

export async function granCompraForecast(familyId: string): Promise<GranCompraForecast> {
  const orders = await getOrderSummaries(familyId);
  const members = await prisma.familyMember.findMany({
    where: { familyId, isActive: true },
    select: { userId: true, name: true },
  });

  const buyers = buyerCycles(orders, members);
  const stats = productCycleStats(orders, familyId);

  // Enrich with categories from purchase_history
  const categories = await prisma.purchaseHistory.findMany({
    where: { familyId, groupKey: { in: stats.map((s) => s.groupKey) } },
    select: { groupKey: true, category: true },
    distinct: ['groupKey'],
  });
  const catMap = new Map(categories.map((c) => [c.groupKey, c.category]));
  for (const s of stats) s.category = catMap.get(s.groupKey) ?? null;

  // Enrich with typical store
  const storeData = await prisma.$queryRaw<{ groupKey: string; storeSlug: string; cnt: bigint }[]>`
    SELECT "groupKey", "storeSlug", COUNT(*) as cnt
    FROM purchase_history
    WHERE "familyId" = ${familyId} AND "storeSlug" IS NOT NULL
    GROUP BY "groupKey", "storeSlug"
    ORDER BY "groupKey", cnt DESC
  `;
  const storeMap = new Map<string, string>();
  for (const r of storeData) {
    if (!storeMap.has(r.groupKey)) storeMap.set(r.groupKey, r.storeSlug);
  }
  for (const s of stats) s.typicalStore = storeMap.get(s.groupKey) ?? null;

  // Enrich with avg quantity from big orders
  const qtyData = await prisma.$queryRaw<{ groupKey: string; avgQty: number }[]>`
    SELECT ph."groupKey", AVG(ph.quantity) as "avgQty"
    FROM purchase_history ph
    INNER JOIN (
      SELECT "orderRef", SUM(price * quantity) as total
      FROM purchase_history
      WHERE "familyId" = ${familyId}
      GROUP BY "orderRef"
      HAVING SUM(price * quantity) >= ${BIG_SHOP_MIN_TOTAL}
    ) big ON ph."orderRef" = big."orderRef"
    WHERE ph."familyId" = ${familyId}
    GROUP BY ph."groupKey"
  `;
  const qtyMap = new Map(qtyData.map((r) => [r.groupKey, Math.round(Number(r.avgQty) * 10) / 10]));
  for (const s of stats) s.avgQuantity = qtyMap.get(s.groupKey) ?? 1;

  // Classify products
  const mustBuy = stats.filter((s) => s.cycleRate >= 0.6 && s.lastSeenCyclesAgo >= 1);
  const shouldBuy = stats.filter((s) => s.cycleRate >= 0.3 && s.cycleRate < 0.6);
  const optional = stats.filter((s) => s.cycleRate >= 0.15 && s.cycleRate < 0.3);

  // Next gran compra = closest predicted date
  const now = Date.now();
  const upcoming = buyers
    .filter((b) => b.nextPredicted)
    .map((b) => ({ buyer: b.userName || b.userId, date: b.nextPredicted!, daysFromNow: Math.round((new Date(b.nextPredicted!).getTime() - now) / 86400000) }))
    .sort((a, b) => a.daysFromNow - b.daysFromNow);

  const calories = await estimateCalories(familyId);

  return {
    buyers,
    nextGranCompra: upcoming[0] ?? null,
    mustBuy,
    shouldBuy,
    optional,
    calories,
    totalProducts: stats.length,
    analyzedOrders: orders.length,
  };
}
