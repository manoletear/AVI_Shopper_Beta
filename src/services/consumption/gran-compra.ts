/**
 * Modelo de predicción basado en ciclos de Gran Compra.
 *
 * Para cada producto calcula:
 * - Stock estimado (cuánto queda en la casa)
 * - Días restantes (cuándo se acaba)
 * - Cuánto comprar (para cubrir el próximo ciclo)
 * - Semáforo: rojo (se acabó), amarillo (esta semana), verde (OK)
 */

import { prisma } from '@/lib/prisma';

const BIG_SHOP_MIN_TOTAL = 50000;
const BIG_SHOP_MIN_ITEMS = 15;
const RECENT_CYCLES = 10;

// ── Tipos públicos ──────────────────────────────────────────────

export interface PantryProduct {
  groupKey: string;
  category: string | null;
  status: 'red' | 'yellow' | 'green';
  statusLabel: string;
  daysSinceLastPurchase: number;
  avgIntervalDays: number;
  dailyConsumptionRate: number;
  estimatedStockLeft: number;
  estimatedDaysLeft: number;
  suggestedQuantity: number;
  avgQuantityPerCycle: number;
  lastPrice: number | null;
  typicalStore: string | null;
  estimatedCost: number | null;
  cycleRate: number;
  unit: string | null;
}

export interface BuyerCycle {
  userId: string;
  userName: string | null;
  totalOrders: number;
  granCompras: number;
  medianIntervalDays: number;
  lastGranCompra: string | null;
  nextPredicted: string | null;
  daysUntilNext: number | null;
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
  estimatedCartTotal: number;
  pantry: {
    red: PantryProduct[];
    yellow: PantryProduct[];
    green: PantryProduct[];
  };
  calories: HouseholdCalories;
  analyzedOrders: number;
}

// ── Internos ────────────────────────────────────────────────────

interface OrderSummary {
  orderRef: string;
  userId: string;
  date: Date;
  itemCount: number;
  total: number;
  type: 'gran_compra' | 'complementaria';
  groupKeys: string[];
}

interface ProductPurchaseData {
  dates: Date[];
  quantities: number[];
  prices: number[];
  stores: string[];
  category: string | null;
  unit: string | null;
}

async function getOrderSummaries(familyId: string): Promise<{ orders: OrderSummary[]; byProduct: Map<string, ProductPurchaseData> }> {
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
      unit: true,
    },
    orderBy: { purchasedAt: 'asc' },
  });

  const byOrder = new Map<string, { userId: string; date: Date; items: { groupKey: string; price: number; quantity: number; store: string }[] }>();
  const byProduct = new Map<string, ProductPurchaseData>();

  for (const r of rows) {
    const gk = r.groupKey || 'unknown';
    const ref = r.orderRef || `solo-${r.purchasedAt.toISOString()}`;
    const qty = r.quantity ?? 1;
    const price = r.price ?? 0;

    if (!byOrder.has(ref)) byOrder.set(ref, { userId: r.userId, date: r.purchasedAt, items: [] });
    byOrder.get(ref)!.items.push({ groupKey: gk, price: price * qty, quantity: qty, store: r.storeSlug || '' });

    if (!byProduct.has(gk)) byProduct.set(gk, { dates: [], quantities: [], prices: [], stores: [], category: null, unit: null });
    const pd = byProduct.get(gk)!;
    pd.dates.push(r.purchasedAt);
    pd.quantities.push(qty);
    pd.prices.push(price);
    pd.stores.push(r.storeSlug || '');
    pd.category = r.category;
    pd.unit = r.unit;
  }

  const orders: OrderSummary[] = [];
  for (const [orderRef, o] of byOrder) {
    const total = o.items.reduce((s, i) => s + i.price, 0);
    orders.push({
      orderRef, userId: o.userId, date: o.date, itemCount: o.items.length, total,
      type: total >= BIG_SHOP_MIN_TOTAL || o.items.length >= BIG_SHOP_MIN_ITEMS ? 'gran_compra' : 'complementaria',
      groupKeys: [...new Set(o.items.map((i) => i.groupKey))],
    });
  }

  return { orders: orders.sort((a, b) => a.date.getTime() - b.date.getTime()), byProduct };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [k, c] of counts) if (c > max) { best = k; max = c; }
  return best;
}

function buyerCycles(orders: OrderSummary[], familyMembers: { userId: string | null; name: string }[]): BuyerCycle[] {
  const byBuyer = new Map<string, OrderSummary[]>();
  for (const o of orders) {
    if (!byBuyer.has(o.userId)) byBuyer.set(o.userId, []);
    byBuyer.get(o.userId)!.push(o);
  }

  const now = Date.now();
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
      daysUntilNext: next ? Math.round((next.getTime() - now) / 86400000) : null,
      confidence: big.length >= 6 ? 'alta' : big.length >= 3 ? 'media' : 'baja',
    });
  }
  return result;
}

function buildPantry(orders: OrderSummary[], byProduct: Map<string, ProductPurchaseData>): PantryProduct[] {
  const bigOrders = orders.filter((o) => o.type === 'gran_compra');
  const recent = bigOrders.slice(-RECENT_CYCLES);
  if (recent.length === 0) return [];

  const now = Date.now();
  const products: PantryProduct[] = [];

  for (const [gk, pd] of byProduct) {
    if (pd.dates.length < 2) continue;

    // Cycle rate: in how many of the last N gran compras did this product appear
    const inRecentCycles = recent.filter((o) => o.groupKeys.includes(gk)).length;
    const cycleRate = inRecentCycles / recent.length;
    if (cycleRate < 0.15) continue;

    // Average quantity per purchase
    const avgQty = pd.quantities.reduce((s, q) => s + q, 0) / pd.quantities.length;

    // Average interval between purchases (days)
    const intervals: number[] = [];
    for (let i = 1; i < pd.dates.length; i++) {
      const d = Math.round((pd.dates[i].getTime() - pd.dates[i - 1].getTime()) / 86400000);
      if (d > 0 && d < 120) intervals.push(d);
    }
    const avgInterval = intervals.length > 0 ? median(intervals) : 30;

    // Daily consumption rate
    const dailyRate = avgInterval > 0 ? avgQty / avgInterval : 0;

    // Days since last purchase
    const lastDate = pd.dates[pd.dates.length - 1];
    const daysSince = Math.round((now - lastDate.getTime()) / 86400000);

    // Estimated stock: what they bought last time, minus what they've consumed since
    const lastQty = pd.quantities[pd.quantities.length - 1];
    const consumed = dailyRate * daysSince;
    const stockLeft = Math.max(0, Math.round((lastQty - consumed) * 10) / 10);

    // Days until empty
    const daysLeft = dailyRate > 0 ? Math.max(0, Math.round(stockLeft / dailyRate)) : 999;

    // Status semaphore
    let status: 'red' | 'yellow' | 'green';
    let statusLabel: string;
    if (daysLeft <= 0 || daysSince > avgInterval * 1.3) {
      status = 'red';
      statusLabel = 'Se acabó';
    } else if (daysLeft <= 7) {
      status = 'yellow';
      statusLabel = `~${daysLeft} día${daysLeft === 1 ? '' : 's'}`;
    } else {
      status = 'green';
      statusLabel = `~${daysLeft} días`;
    }

    // Suggested quantity: enough for one full cycle
    const suggestedQty = Math.max(1, Math.round(dailyRate * avgInterval * 10) / 10);

    // Last price and typical store
    const lastPrice = pd.prices[pd.prices.length - 1] || null;
    const typicalStore = mode(pd.stores);
    const estimatedCost = lastPrice && suggestedQty ? Math.round(lastPrice * suggestedQty) : null;

    products.push({
      groupKey: gk,
      category: pd.category,
      status,
      statusLabel,
      daysSinceLastPurchase: daysSince,
      avgIntervalDays: avgInterval,
      dailyConsumptionRate: Math.round(dailyRate * 100) / 100,
      estimatedStockLeft: stockLeft,
      estimatedDaysLeft: daysLeft,
      suggestedQuantity: suggestedQty,
      avgQuantityPerCycle: Math.round(avgQty * 10) / 10,
      lastPrice,
      typicalStore,
      estimatedCost,
      cycleRate,
      unit: pd.unit,
    });
  }

  return products.sort((a, b) => a.estimatedDaysLeft - b.estimatedDaysLeft);
}

async function estimateCalories(familyId: string): Promise<HouseholdCalories> {
  const since = new Date(Date.now() - 90 * 86400000);
  const purchases = await prisma.purchaseHistory.findMany({
    where: { familyId, purchasedAt: { gte: since } },
    select: { groupKey: true, quantity: true, purchasedAt: true, price: true },
  });

  if (purchases.length === 0) return { dailyKcalEstimate: 0, weeklySpendClp: 0, topCalorieSources: [], dataWindowDays: 0 };

  const earliest = purchases.reduce((min, p) => p.purchasedAt < min ? p.purchasedAt : min, purchases[0].purchasedAt);
  const dataWindowDays = Math.max(1, Math.round((Date.now() - earliest.getTime()) / 86400000));

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
    const kcal = (KCAL_PER_UNIT[gk] || 500) * qty;
    const spend = (p.price ?? 0) * qty;
    totalKcal += kcal;
    totalSpend += spend;
    if (!byGroup.has(gk)) byGroup.set(gk, { totalKcal: 0, totalSpend: 0 });
    const g = byGroup.get(gk)!;
    g.totalKcal += kcal;
    g.totalSpend += spend;
  }

  const topSources = [...byGroup.entries()]
    .map(([group, d]) => ({
      group,
      kcalPerWeek: Math.round(d.totalKcal / dataWindowDays * 7),
      pctOfTotal: totalKcal > 0 ? Math.round(d.totalKcal / totalKcal * 100) : 0,
    }))
    .filter((s) => s.pctOfTotal >= 2)
    .sort((a, b) => b.kcalPerWeek - a.kcalPerWeek)
    .slice(0, 10);

  return {
    dailyKcalEstimate: Math.round(totalKcal / dataWindowDays),
    weeklySpendClp: Math.round(totalSpend / dataWindowDays * 7),
    topCalorieSources: topSources,
    dataWindowDays,
  };
}

// ── Export principal ────────────────────────────────────────────

export async function granCompraForecast(familyId: string): Promise<GranCompraForecast> {
  const { orders, byProduct } = await getOrderSummaries(familyId);
  const members = await prisma.familyMember.findMany({
    where: { familyId, isActive: true },
    select: { userId: true, name: true },
  });

  const buyers = buyerCycles(orders, members);
  const products = buildPantry(orders, byProduct);

  const red = products.filter((p) => p.status === 'red');
  const yellow = products.filter((p) => p.status === 'yellow');
  const green = products.filter((p) => p.status === 'green');

  const toBuy = [...red, ...yellow];
  const estimatedCartTotal = toBuy.reduce((s, p) => s + (p.estimatedCost || 0), 0);

  const now = Date.now();
  const upcoming = buyers
    .filter((b) => b.nextPredicted)
    .map((b) => ({ buyer: b.userName || b.userId, date: b.nextPredicted!, daysFromNow: Math.round((new Date(b.nextPredicted!).getTime() - now) / 86400000) }))
    .sort((a, b) => a.daysFromNow - b.daysFromNow);

  const calories = await estimateCalories(familyId);

  return {
    buyers,
    nextGranCompra: upcoming[0] ?? null,
    estimatedCartTotal,
    pantry: { red, yellow, green },
    calories,
    analyzedOrders: orders.length,
  };
}
