/**
 * Inteligencia de consumo del hogar.
 *
 * Aprende de cada compra y se actualiza sola:
 * - Quién consume qué (niños → colación, adultos → cotidiano)
 * - Cuánto por persona por día según contexto
 * - Patrones de día de semana (lun-vie colación, fin de semana asado)
 * - Alertas inteligentes: "no alcanza al viernes"
 *
 * No es un cálculo estático: cada compra refina las tasas.
 */

import { prisma } from '@/lib/prisma';

// ── Contexto de consumo inferido ────────────────────────────────

type ConsumptionContext = 'colacion' | 'cotidiano' | 'asado' | 'picoteo' | 'coctel' | 'mascota' | 'limpieza';

const CONTEXT_MAP: Record<string, ConsumptionContext> = {
  yoghurt: 'colacion', leche_chocolate: 'colacion', dulces_chocolates: 'colacion',
  barra_cereal: 'colacion', jugo_nectar_familiar: 'colacion', galletas: 'colacion',
  frutos_secos: 'colacion',

  pan_molde: 'cotidiano', pan_marraqueta_hallulla: 'cotidiano', huevos: 'cotidiano',
  leche_entera: 'cotidiano', leche_cultivada: 'cotidiano', queso_gauda_laminado: 'cotidiano',
  mantequilla: 'cotidiano', pechuga_pavo: 'cotidiano', jamon: 'cotidiano',
  arroz: 'cotidiano', pasta: 'cotidiano', aceite: 'cotidiano', tomate: 'cotidiano',
  cebolla: 'cotidiano', zanahoria: 'cotidiano', palta: 'cotidiano', lechuga: 'cotidiano',
  platano: 'cotidiano', manzana: 'cotidiano', cereal: 'cotidiano',

  carne_asado: 'asado', carbon: 'asado', longaniza: 'asado', vino_castillo_molina_carmenere: 'asado',
  vino_otro: 'asado', pan_ciabatta: 'asado', aji_verde: 'asado', cerdo: 'asado',

  snack_salado: 'picoteo', papas_prefritas: 'picoteo', congelado_coctel: 'picoteo',
  queso_brie_camembert: 'picoteo', queso_savoyard: 'picoteo', jamon_serrano: 'picoteo',

  coca_cola_zero_1_5l: 'cotidiano', hielo: 'coctel', pisco_sour: 'coctel',
  licor_otro: 'coctel', cerveza: 'coctel',

  bolsas_basura: 'limpieza', cloro: 'limpieza', detergente: 'limpieza',
  esponjas_panos: 'limpieza', papel_higienico: 'limpieza',
};

function inferContext(groupKey: string, category: string | null): ConsumptionContext {
  if (CONTEXT_MAP[groupKey]) return CONTEXT_MAP[groupKey];
  if (category === 'aseo' || category === 'limpieza') return 'limpieza';
  if (category === 'mascotas') return 'mascota';
  if (category === 'vinos' || category === 'licores') return 'coctel';
  if (category === 'snacks') return 'picoteo';
  return 'cotidiano';
}

// ── Consumidores por contexto ───────────────────────────────────

interface FamilyComposition {
  adults: number;
  children: number;
  total: number;
  hasNana: boolean;
  hasPets: boolean;
}

function getFamilyComposition(members: { role: string; type: string; isActive: boolean }[]): FamilyComposition {
  const active = members.filter((m) => m.isActive && m.type === 'person');
  return {
    adults: active.filter((m) => m.role === 'master' || m.role === 'adult' || m.role === 'elder').length,
    children: active.filter((m) => m.role === 'child').length,
    total: active.length,
    hasNana: active.some((m) => m.role === 'nana'),
    hasPets: members.some((m) => m.isActive && m.type === 'pet'),
  };
}

function consumersForContext(ctx: ConsumptionContext, family: FamilyComposition): number {
  switch (ctx) {
    case 'colacion': return Math.max(1, family.children + (family.hasNana ? 0 : 0));
    case 'cotidiano': return family.total;
    case 'asado': return family.total;
    case 'picoteo': return family.total;
    case 'coctel': return family.adults;
    case 'mascota': return family.hasPets ? 1 : 0;
    case 'limpieza': return 1;
  }
}

// ── Días activos por contexto ───────────────────────────────────

function activeDaysPerWeek(ctx: ConsumptionContext): number {
  switch (ctx) {
    case 'colacion': return 5;
    case 'cotidiano': return 7;
    case 'asado': return 1;
    case 'picoteo': return 3;
    case 'coctel': return 2;
    case 'mascota': return 7;
    case 'limpieza': return 7;
  }
}

function activeDaysUntil(ctx: ConsumptionContext, targetDate: Date, fromDate: Date = new Date()): number {
  const totalDays = Math.max(0, Math.ceil((targetDate.getTime() - fromDate.getTime()) / 86400000));
  if (ctx === 'cotidiano' || ctx === 'mascota' || ctx === 'limpieza') return totalDays;

  let active = 0;
  const d = new Date(fromDate);
  for (let i = 0; i < totalDays; i++) {
    const dow = d.getDay();
    const isWeekday = dow >= 1 && dow <= 5;
    const isWeekend = dow === 0 || dow === 6;

    if (ctx === 'colacion' && isWeekday) active++;
    else if (ctx === 'asado' && isWeekend) active++;
    else if (ctx === 'picoteo') active++;
    else if (ctx === 'coctel' && isWeekend) active++;

    d.setDate(d.getDate() + 1);
  }
  return active;
}

// ── Producto inteligente ────────────────────────────────────────

export interface SmartProduct {
  groupKey: string;
  category: string | null;
  context: ConsumptionContext;
  contextLabel: string;

  status: 'red' | 'yellow' | 'green';
  statusLabel: string;
  alertMessage: string | null;

  estimatedStockLeft: number;
  estimatedDaysLeft: number;
  consumptionPerDay: number;
  consumersCount: number;
  perPersonPerDay: number;

  suggestedQuantity: number;
  lastPrice: number | null;
  estimatedCost: number | null;
  typicalStore: string | null;
  unit: string | null;

  reachesNextShop: boolean;
  nextShopIn: number;
}

export interface HouseholdIntelligence {
  family: {
    adults: number;
    children: number;
    total: number;
  };
  nextGranCompra: {
    buyer: string;
    daysFromNow: number;
    date: string;
  } | null;
  estimatedCartTotal: number;
  alerts: SmartProduct[];
  pantry: SmartProduct[];
  ok: SmartProduct[];
  weeklySpendClp: number;
  dailyKcalEstimate: number;
}

const CONTEXT_LABELS: Record<ConsumptionContext, string> = {
  colacion: 'Colación (lun-vie)',
  cotidiano: 'Uso diario',
  asado: 'Asado / parrilla',
  picoteo: 'Picoteo',
  coctel: 'Cóctel / social',
  mascota: 'Mascota',
  limpieza: 'Limpieza del hogar',
};

export async function getHouseholdIntelligence(familyId: string): Promise<HouseholdIntelligence> {
  const [members, purchases] = await Promise.all([
    prisma.familyMember.findMany({
      where: { familyId, isActive: true },
      select: { userId: true, name: true, role: true, type: true, isActive: true },
    }),
    prisma.purchaseHistory.findMany({
      where: { familyId },
      select: {
        orderRef: true, userId: true, purchasedAt: true, price: true,
        quantity: true, groupKey: true, category: true, storeSlug: true, unit: true,
        motivo: true,
      },
      orderBy: { purchasedAt: 'asc' },
    }),
  ]);

  const family = getFamilyComposition(members);
  const now = new Date();
  const nowMs = now.getTime();

  // ── Classify orders & find buyer cycles ──
  const byOrder = new Map<string, { userId: string; date: Date; total: number; count: number }>();
  for (const r of purchases) {
    const ref = r.orderRef || `s-${r.purchasedAt.toISOString()}`;
    if (!byOrder.has(ref)) byOrder.set(ref, { userId: r.userId, date: r.purchasedAt, total: 0, count: 0 });
    const o = byOrder.get(ref)!;
    o.total += (r.price ?? 0) * (r.quantity ?? 1);
    o.count++;
  }

  // Find next gran compra per buyer
  const buyerBigDates = new Map<string, Date[]>();
  for (const [, o] of byOrder) {
    if (o.total >= BIG_SHOP_MIN_TOTAL || o.count >= BIG_SHOP_MIN_ITEMS) {
      if (!buyerBigDates.has(o.userId)) buyerBigDates.set(o.userId, []);
      buyerBigDates.get(o.userId)!.push(o.date);
    }
  }

  let nextShopDays = 7;
  let nextShopBuyer = '';
  let nextShopDate = '';

  for (const [userId, dates] of buyerBigDates) {
    if (dates.length < 2) continue;
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const d = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
      if (d > 0 && d < 60) intervals.push(d);
    }
    if (!intervals.length) continue;
    const sorted = [...intervals].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const last = dates[dates.length - 1];
    const nextDate = new Date(last.getTime() + med * 86400000);
    const daysUntil = Math.round((nextDate.getTime() - nowMs) / 86400000);

    if (!nextShopBuyer || daysUntil < nextShopDays) {
      nextShopDays = daysUntil;
      nextShopBuyer = members.find((m) => m.userId === userId)?.name || userId;
      nextShopDate = nextDate.toISOString();
    }
  }

  const nextGranCompra = nextShopBuyer
    ? { buyer: nextShopBuyer, daysFromNow: nextShopDays, date: nextShopDate }
    : null;

  // If next shop is in the past, assume it's overdue and shopping should happen today
  const effectiveNextShopDays = Math.max(1, nextShopDays);

  // Motivos que afectan la tasa diaria de consumo
  const MOTIVOS_COTIDIANOS = new Set(['para_la_casa', 'lo_que_falto', 'colaciones']);

  // ── Build per-product intelligence ──
  const byProduct = new Map<string, {
    dates: Date[]; quantities: number[]; prices: number[];
    stores: string[]; category: string | null; unit: string | null;
    motivoCounts: Map<string, number>;
    cotidianoDates: Date[]; cotidianoQuantities: number[];
  }>();

  for (const r of purchases) {
    const gk = r.groupKey || 'unknown';
    if (!byProduct.has(gk)) byProduct.set(gk, {
      dates: [], quantities: [], prices: [], stores: [],
      category: null, unit: null,
      motivoCounts: new Map(), cotidianoDates: [], cotidianoQuantities: [],
    });
    const pd = byProduct.get(gk)!;
    const motivo = (r as any).motivo || 'para_la_casa';
    pd.motivoCounts.set(motivo, (pd.motivoCounts.get(motivo) || 0) + 1);
    if (MOTIVOS_COTIDIANOS.has(motivo)) {
      pd.cotidianoDates.push(r.purchasedAt);
      pd.cotidianoQuantities.push(r.quantity ?? 1);
    };
    pd.dates.push(r.purchasedAt);
    pd.quantities.push(r.quantity ?? 1);
    pd.prices.push(r.price ?? 0);
    pd.stores.push(r.storeSlug || '');
    pd.category = r.category;
    pd.unit = r.unit;
  }

  const products: SmartProduct[] = [];
  let totalSpend90 = 0;
  let totalKcal90 = 0;
  const since90 = nowMs - 90 * 86400000;

  const KCAL: Record<string, number> = {
    arroz: 3500, pan_molde: 1200, pasta: 3500, huevos: 900,
    yoghurt: 500, leche_chocolate: 500, leche_cultivada: 400,
    queso_gauda_laminado: 1800, mantequilla: 1800,
    pollo_trutro: 2000, carne_asado: 2500, cerdo: 2200,
    palta: 800, platano: 400, galletas: 2000, snack_salado: 2500,
    dulces_chocolates: 2500, frutos_secos: 3000,
    coca_cola_zero_1_5l: 5, pechuga_pavo: 800,
  };

  for (const [gk, pd] of byProduct) {
    if (pd.dates.length < 2) continue;

    const ctx = inferContext(gk, pd.category);
    const consumers = consumersForContext(ctx, family);
    if (consumers === 0) continue;

    // Tasa diaria usa SOLO compras cotidianas (para_la_casa, lo_que_falto, colaciones).
    // Compras de evento (asado, cumple, carrete) no inflan el consumo diario.
    const useDates = pd.cotidianoDates.length >= 2 ? pd.cotidianoDates : pd.dates;
    const useQtys = pd.cotidianoQuantities.length >= 2 ? pd.cotidianoQuantities : pd.quantities;

    const intervals: number[] = [];
    for (let i = 1; i < useDates.length; i++) {
      const d = Math.round((useDates[i].getTime() - useDates[i - 1].getTime()) / 86400000);
      if (d > 0 && d < 120) intervals.push(d);
    }
    const medInterval = intervals.length > 0 ? [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)] : 30;

    const recentN = Math.min(5, useQtys.length);
    const recentQtys = useQtys.slice(-recentN);
    const avgQty = recentQtys.reduce((s, q) => s + q, 0) / recentQtys.length;
    const dailyRate = medInterval > 0 ? avgQty / medInterval : 0;
    const perPersonPerDay = consumers > 0 ? dailyRate / consumers : dailyRate;

    // Stock estimation
    const lastDate = pd.dates[pd.dates.length - 1];
    const daysSince = Math.round((nowMs - lastDate.getTime()) / 86400000);
    const lastQty = pd.quantities[pd.quantities.length - 1];

    // Adjust consumption by active days (colación only weekdays, etc.)
    const activeDaysSince = activeDaysUntil(ctx, now, lastDate);
    const consumed = perPersonPerDay * consumers * activeDaysSince;
    const stockLeft = Math.max(0, Math.round((lastQty - consumed) * 10) / 10);

    // Days left considering only active days
    const activeDaysPerW = activeDaysPerWeek(ctx);
    const dailyActiveRate = perPersonPerDay * consumers * (activeDaysPerW / 7);
    const daysLeft = dailyActiveRate > 0 ? Math.max(0, Math.round(stockLeft / dailyActiveRate)) : 999;

    // Does stock reach the next shopping trip?
    const nextShopTargetDate = new Date(nowMs + effectiveNextShopDays * 86400000);
    const activeDaysToShop = activeDaysUntil(ctx, nextShopTargetDate, now);
    const neededForNextShop = perPersonPerDay * consumers * activeDaysToShop;
    const reachesNextShop = stockLeft >= neededForNextShop;

    // Status & alert
    let status: 'red' | 'yellow' | 'green';
    let statusLabel: string;
    let alertMessage: string | null = null;

    if (daysLeft <= 0 || daysSince > medInterval * 1.5) {
      status = 'red';
      statusLabel = 'Se acabó';
      alertMessage = `Sin ${gk.replace(/_/g, ' ')} hace ${daysSince - medInterval} días.`;
    } else if (!reachesNextShop) {
      status = 'yellow';
      const dayName = nextShopTargetDate.toLocaleDateString('es-CL', { weekday: 'long' });
      statusLabel = `No alcanza al ${dayName}`;
      alertMessage = `Quedan ~${stockLeft} ${pd.unit || 'un'}. ${ctx === 'colacion' ? `Con ${consumers} niño${consumers > 1 ? 's' : ''} no llegan al ${dayName}.` : `No alcanza hasta la próxima compra.`}`;
    } else {
      status = 'green';
      statusLabel = `~${daysLeft} días`;
    }

    // Suggested quantity: enough for one full cycle
    const suggestedQty = Math.max(1, Math.ceil(dailyRate * medInterval));
    const lastPrice = pd.prices[pd.prices.length - 1] || null;
    const typicalStore = mode(pd.stores);
    const estimatedCost = lastPrice ? Math.round(lastPrice * suggestedQty) : null;

    products.push({
      groupKey: gk, category: pd.category, context: ctx,
      contextLabel: CONTEXT_LABELS[ctx],
      status, statusLabel, alertMessage,
      estimatedStockLeft: stockLeft, estimatedDaysLeft: daysLeft,
      consumptionPerDay: Math.round(dailyActiveRate * 100) / 100,
      consumersCount: consumers, perPersonPerDay: Math.round(perPersonPerDay * 100) / 100,
      suggestedQuantity: suggestedQty, lastPrice, estimatedCost, typicalStore,
      unit: pd.unit, reachesNextShop, nextShopIn: effectiveNextShopDays,
    });

    // Calories & spend for 90-day window
    for (let i = 0; i < pd.dates.length; i++) {
      if (pd.dates[i].getTime() >= since90) {
        totalKcal90 += (KCAL[gk] || 500) * pd.quantities[i];
        totalSpend90 += (pd.prices[i] || 0) * pd.quantities[i];
      }
    }
  }

  products.sort((a, b) => a.estimatedDaysLeft - b.estimatedDaysLeft);

  const alerts = products.filter((p) => p.status === 'red' || p.status === 'yellow');
  const ok = products.filter((p) => p.status === 'green');
  const estimatedCartTotal = alerts.reduce((s, p) => s + (p.estimatedCost || 0), 0);
  const window90 = 90;

  return {
    family: { adults: family.adults, children: family.children, total: family.total },
    nextGranCompra,
    estimatedCartTotal,
    alerts,
    pantry: products,
    ok,
    weeklySpendClp: Math.round(totalSpend90 / window90 * 7),
    dailyKcalEstimate: Math.round(totalKcal90 / window90),
  };
}

function mode(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [k, c] of counts) if (c > max) { best = k; max = c; }
  return best;
}
