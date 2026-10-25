/**
 * Predice cuándo se acaba un producto.
 * Con pocas compras usa un prior por categoría, escalado al hogar.
 * Con más compras, un ritmo ponderado que recorta saltos raros.
 * El aviso sale si la cobertura pesimista no alcanza el despacho más un margen.
 * AVI propone. La familia decide. Nadie paga acá.
 */

import { normalizeName, consumptionKey, productIdentity } from '../catalog/normalize';

export type BaseUnit = 'kg' | 'L' | 'un';
export type Confidence = 'insuficiente' | 'baja' | 'media' | 'alta';
export type FeedbackKind = 'ya_tengo' | 'se_acabo_antes' | 'no_compro_mas' | 'cantidad';

export interface PurchaseEvent {
  productName: string;
  quantity: number;
  unit?: string | null;
  purchasedAt: Date | string;
  price?: number | null;
  storeName?: string | null;
  storeSlug?: string | null;
  baseAmount?: number | null;
  baseUnit?: string | null;
  groupKey?: string | null;
  leftover?: number | null;
}

export interface PurchasePoint {
  date: string;
  amount: number;
  unit: BaseUnit;
  storeName?: string | null;
  price?: number | null;
  label: string;
}

export interface ProductForecast {
  key: string;
  identity: string;
  label: string;
  unit: BaseUnit;
  purchases: number;
  confidence: Confidence;
  weeklyAmount: number | null;
  daysLeft: number | null;
  predictedDate: string | null;
  lastAmount: number | null;
  lastDate: string | null;
  lastStore: string | null;
  history: PurchasePoint[];
  alert: boolean;
  urgency: 'add_now' | 'add_soon' | 'monitor' | 'none';
  message: string;
  suggestedQuantity: number;
  ratePerDay: number | null;
  estStock: number | null;
  pessimisticDays: number | null;
  runOutEarly: string | null;
  runOutLate: string | null;
  frozen: boolean;
}

export interface HouseholdMember {
  role: string;
  type: string;
}

export interface HouseholdEventWindow {
  multiplier: number;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  month?: number | null;
  day?: number | null;
  isActive?: boolean;
}

export interface ForecastOptions {
  equivalents?: number;
  alpha?: number;
  leadDays?: number;
  bufferDays?: number;
  events?: HouseholdEventWindow[];
  now?: Date;
}

const DAY = 86_400_000;
const PRIOR_WEIGHT = 2;
const MAD_SCALE = 1.4826;
const DEFAULT_ALPHA = 0.4;
const DEFAULT_LEAD_DAYS = 2;
const DEFAULT_BUFFER_DAYS = 2;

/** Priors de ejemplo, por persona-equivalente y por día. Se calibran con familias reales. */
export const CATEGORY_PRIORS: Record<string, { perPersonDay: number; unit: BaseUnit }> = {
  lacteos: { perPersonDay: 0.25, unit: 'L' },
  panaderia: { perPersonDay: 0.12, unit: 'kg' },
  huevos: { perPersonDay: 0.5, unit: 'un' },
  carnes: { perPersonDay: 0.08, unit: 'kg' },
  abarrotes: { perPersonDay: 0.05, unit: 'kg' },
};

const ROLE_WEIGHT: Record<string, number> = {
  master: 1,
  adult: 1,
  elder: 0.8,
  child: 0.6,
};

const SIZE_TOKEN = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros|un|und|uds)\b/gi;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function productKey(name: string): string {
  return consumptionKey(name);
}

/** Grupo del hogar sin marca. Colun entera y Soprole entera comparten grupo. */
export function householdGroupKey(name: string): string {
  const text = name.toLowerCase();
  if (/\bhuevos?\b/.test(text)) return 'huevos|general';
  const norm = normalizeName(name);
  return `${norm.category}|${norm.variant || 'general'}`;
}

export function priorFor(name: string): { perPersonDay: number; unit: BaseUnit; category: string } {
  const key = householdGroupKey(name);
  const category = key.startsWith('huevos') ? 'huevos' : key.split('|')[0] ?? 'general';
  const prior = CATEGORY_PRIORS[category] || { perPersonDay: 0.05, unit: 'un' as BaseUnit };
  return { ...prior, category };
}

/** Adulto 1, mayor 0,8, niño 0,6. Las mascotas no entran en N. */
export function householdEquivalents(members: HouseholdMember[], elderWeight = ROLE_WEIGHT.elder ?? 0.8): number {
  const people = members.filter((member) => member.type !== 'pet');
  if (!people.length) return 1;
  const total = people.reduce((sum, member) => {
    if (member.role === 'elder') return sum + elderWeight;
    return sum + (ROLE_WEIGHT[member.role] ?? 1);
  }, 0);
  return total > 0 ? total : 1;
}

/**
 * Si el hogar indicó para cuántos compra, ese número manda.
 * Cada adulto mayor dentro de ese tamaño pesa 0,8 en vez de 1.
 */
export function plannedEquivalents(
  members: HouseholdMember[],
  householdSize: number | null | undefined,
  elderWeight = ROLE_WEIGHT.elder ?? 0.8,
): number {
  const people = members.filter((member) => member.type !== 'pet');
  if (householdSize && householdSize > 0) {
    const elders = Math.min(people.filter((member) => member.role === 'elder').length, householdSize);
    return (householdSize - elders) + elders * elderWeight;
  }
  return householdEquivalents(people, elderWeight);
}

export function coldStartRate(perPersonDay: number, equivalents: number): number {
  return perPersonDay * Math.max(equivalents, 0);
}

/** r = (k · r0 + n · x̄) / (k + n). k = 2 compras de peso para el prior. */
export function shrinkRate(prior: number, observedMean: number, observations: number, k = PRIOR_WEIGHT): number {
  const n = Math.max(0, observations);
  if (n + k <= 0) return observedMean;
  return (k * prior + n * observedMean) / (k + n);
}

export function robustEwma(rates: number[], alpha = DEFAULT_ALPHA): { mu: number; sd: number } {
  if (!rates.length) return { mu: 0, sd: 0 };
  const a = clampAlpha(alpha);
  const sorted = [...rates].sort((left, right) => left - right);
  const med = sorted[Math.floor(sorted.length / 2)];
  if (med === undefined) return { mu: 0, sd: 0 };
  const deviations = rates.map((rate) => Math.abs(rate - med)).sort((left, right) => left - right);
  const mad = deviations[Math.floor(rates.length / 2)] || Math.abs(med) * 0.2 || 0.01;
  let mu = 0;
  let variance = 0;
  rates.forEach((rate, index) => {
    const clipped = clipRate(rate, med, mad);
    if (index === 0) {
      mu = clipped;
      return;
    }
    const delta = clipped - mu;
    mu += a * delta;
    variance = (1 - a) * (variance + a * delta * delta);
  });
  return { mu, sd: Math.sqrt(Math.max(variance, 0)) };
}

export function clipRate(rate: number, median: number, mad: number): number {
  const scale = (mad || Math.abs(median) * 0.2 || 0.01) * 3 * MAD_SCALE;
  return Math.min(Math.max(rate, median - scale), median + scale);
}

function clampAlpha(alpha: number): number {
  return Math.min(Math.max(alpha || DEFAULT_ALPHA, 0.05), 0.95);
}

export interface ProfileState {
  ratePerDay: number;
  rateVar: number;
  rateMedian: number;
  rateMad: number;
  avgInterval: number;
  nPurchases: number;
  nIntervals: number;
  lastPurchaseAt: string | null;
  lastAmount: number;
  leftover: number;
  estStock: number;
  stockAnchoredAt: string | null;
  confidence: Confidence;
  frozen: boolean;
  seasonFactor: number;
  monthCounts: number[];
  unit: BaseUnit;
}

export function emptyProfile(unit: BaseUnit = 'un'): ProfileState {
  return {
    ratePerDay: 0,
    rateVar: 0,
    rateMedian: 0,
    rateMad: 0,
    avgInterval: 0,
    nPurchases: 0,
    nIntervals: 0,
    lastPurchaseAt: null,
    lastAmount: 0,
    leftover: 0,
    estStock: 0,
    stockAnchoredAt: null,
    confidence: 'baja',
    frozen: false,
    seasonFactor: 1,
    monthCounts: Array.from({ length: 12 }, () => 0),
    unit,
  };
}

/**
 * Una compra nueva mueve el perfil. No vuelve a recorrer la historia.
 * El mismo día se suma al último evento. Un día distinto abre un intervalo.
 */
export function applyPurchase(
  profile: ProfileState,
  purchase: { at: Date | string; amount: number; leftover?: number },
  options: ForecastOptions = {},
): ProfileState {
  if (profile.frozen) return profile;
  const at = asDate(purchase.at);
  const amount = purchase.amount;
  if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(at.getTime())) return profile;
  const next = { ...profile, monthCounts: [...profile.monthCounts] };
  const monthIndex = at.getUTCMonth();
  next.monthCounts[monthIndex] = (next.monthCounts[monthIndex] ?? 0) + amount;
  next.nPurchases += 1;
  next.seasonFactor = seasonFactor(next.monthCounts, at.getUTCMonth());

  if (next.lastPurchaseAt && dayKey(asDate(next.lastPurchaseAt)) === dayKey(at)) {
    next.lastAmount += amount;
    next.estStock += amount;
    next.stockAnchoredAt = next.lastPurchaseAt;
    return next;
  }

  if (!next.lastPurchaseAt) {
    next.lastPurchaseAt = at.toISOString();
    next.lastAmount = amount;
    next.leftover = purchase.leftover || 0;
    next.estStock = amount + next.leftover;
    next.stockAnchoredAt = at.toISOString();
    next.rateMedian = 0;
    next.rateMad = 0;
    return next;
  }

  const previousAt = asDate(next.lastPurchaseAt);
  const gap = Math.max(daysBetween(previousAt, at), 0);
  if (gap <= 0) {
    next.lastAmount += amount;
    next.estStock += amount;
    return next;
  }

  const observed = (next.lastAmount + next.leftover - (purchase.leftover || 0)) / gap;
  const median = next.nIntervals === 0 ? observed : next.rateMedian;
  const mad = next.nIntervals === 0 ? Math.abs(observed) * 0.2 || 0.01 : next.rateMad || Math.abs(median) * 0.2 || 0.01;
  const clipped = clipRate(observed, median, mad);
  const alpha = clampAlpha(options.alpha ?? DEFAULT_ALPHA);
  if (next.nIntervals === 0) {
    next.ratePerDay = clipped;
    next.rateVar = 0;
  } else {
    const delta = clipped - next.ratePerDay;
    next.ratePerDay += alpha * delta;
    next.rateVar = (1 - alpha) * (next.rateVar + alpha * delta * delta);
  }
  next.rateMedian = next.nIntervals === 0 ? clipped : next.rateMedian + 0.2 * (clipped - next.rateMedian);
  next.rateMad = next.nIntervals === 0 ? mad : next.rateMad + 0.2 * (Math.abs(observed - next.rateMedian) - next.rateMad);
  next.nIntervals += 1;
  next.avgInterval = next.avgInterval
    ? (next.avgInterval * (next.nIntervals - 1) + gap) / next.nIntervals
    : gap;
  next.lastPurchaseAt = at.toISOString();
  next.lastAmount = amount;
  next.leftover = purchase.leftover || 0;
  next.estStock = amount + next.leftover;
  next.stockAnchoredAt = at.toISOString();
  next.confidence = confidenceOf(next.nPurchases, Math.sqrt(Math.max(next.rateVar, 0)), next.ratePerDay);
  return next;
}

export interface FeedbackInput {
  kind: FeedbackKind;
  at?: Date | string;
  stockReported?: number | null;
}

/** “Ya tengo”, “se acabó antes” o “no lo compro más” corrigen el perfil. */
export function applyFeedback(profile: ProfileState, feedback: FeedbackInput, now = new Date()): ProfileState {
  const next = { ...profile, monthCounts: [...profile.monthCounts] };
  const at = asDate(feedback.at || now);
  if (feedback.kind === 'no_compro_mas') {
    next.frozen = true;
    next.confidence = 'baja';
    return next;
  }
  if (feedback.kind === 'ya_tengo' || feedback.kind === 'cantidad') {
    if (feedback.stockReported != null && Number.isFinite(feedback.stockReported)) {
      next.estStock = Math.max(0, feedback.stockReported);
      next.stockAnchoredAt = at.toISOString();
      next.leftover = next.estStock;
      return next;
    }
    next.ratePerDay = Math.max(next.ratePerDay * 0.9, 0);
    next.estStock = Math.max(next.estStock, next.ratePerDay * 7);
    next.stockAnchoredAt = at.toISOString();
    return next;
  }
  if (feedback.kind === 'se_acabo_antes' && next.lastPurchaseAt) {
    const gap = Math.max(daysBetween(asDate(next.lastPurchaseAt), at), 1);
    const observed = next.lastAmount / gap;
    const median = next.nIntervals === 0 ? observed : next.rateMedian || observed;
    const mad = next.rateMad || Math.abs(median) * 0.2 || 0.01;
    const clipped = clipRate(observed, median, mad);
    const alpha = DEFAULT_ALPHA;
    const delta = clipped - (next.ratePerDay || clipped);
    next.ratePerDay = next.nIntervals === 0 ? clipped : next.ratePerDay + alpha * delta;
    next.rateVar = next.nIntervals === 0 ? 0 : (1 - alpha) * (next.rateVar + alpha * delta * delta);
    next.nIntervals += 1;
    next.rateMedian = median;
    next.estStock = 0;
    next.stockAnchoredAt = at.toISOString();
    next.confidence = confidenceOf(next.nPurchases, Math.sqrt(Math.max(next.rateVar, 0)), next.ratePerDay);
    return next;
  }
  return next;
}

export interface Coverage {
  ratePerDay: number;
  sd: number;
  stock: number;
  daysLeft: number;
  pessimisticDays: number;
  runOut: Date;
  early: Date;
  late: Date;
  alert: boolean;
  confidence: Confidence;
  threshold: number;
}

export function coverageOf(
  profile: Pick<ProfileState, 'ratePerDay' | 'rateVar' | 'lastAmount' | 'leftover' | 'estStock' | 'stockAnchoredAt' | 'lastPurchaseAt' | 'nPurchases' | 'nIntervals' | 'confidence' | 'frozen' | 'seasonFactor'>,
  now: Date,
  options: ForecastOptions & { priorPerDay?: number } = {},
): Coverage | null {
  if (profile.frozen) return null;
  const anchorAt = asDate(profile.stockAnchoredAt || profile.lastPurchaseAt || now);
  const daysSince = Math.max(0, (now.getTime() - anchorAt.getTime()) / DAY);
  const observed = profile.nIntervals > 0 ? profile.ratePerDay : 0;
  const prior = options.priorPerDay ?? 0;
  const shrunk = profile.nIntervals > 0 ? shrinkRate(prior, observed, profile.nIntervals) : prior;
  const event = eventMultiplier(options.events || [], now);
  const season = profile.seasonFactor > 0 ? profile.seasonFactor : 1;
  const rate = Math.max(shrunk * season * event, 0);
  const sd = Math.sqrt(Math.max(profile.rateVar, 0)) * (profile.nIntervals / (profile.nIntervals + PRIOR_WEIGHT));
  const anchorStock = profile.stockAnchoredAt ? profile.estStock : profile.lastAmount + profile.leftover;
  const stock = Math.max(0, anchorStock - rate * daysSince);
  if (rate <= 0) {
    return {
      ratePerDay: 0,
      sd,
      stock,
      daysLeft: Number.POSITIVE_INFINITY,
      pessimisticDays: Number.POSITIVE_INFINITY,
      runOut: new Date(now.getTime() + 365 * DAY),
      early: now,
      late: new Date(now.getTime() + 365 * DAY),
      alert: false,
      confidence: profile.confidence,
      threshold: (options.leadDays ?? DEFAULT_LEAD_DAYS) + bufferFor(profile.confidence, options.bufferDays),
    };
  }
  const daysLeft = stock / rate;
  const pessimistic = stock / (rate + sd);
  const optimisticDenom = Math.max(rate - sd, rate * 0.3);
  const runOut = new Date(now.getTime() + daysLeft * DAY);
  const early = new Date(now.getTime() + pessimistic * DAY);
  const late = new Date(now.getTime() + (stock / optimisticDenom) * DAY);
  const confidence = confidenceOf(profile.nPurchases, sd, rate);
  const threshold = (options.leadDays ?? DEFAULT_LEAD_DAYS) + bufferFor(confidence, options.bufferDays);
  return {
    ratePerDay: rate,
    sd,
    stock,
    daysLeft,
    pessimisticDays: pessimistic,
    runOut,
    early,
    late,
    alert: pessimistic <= threshold,
    confidence,
    threshold,
  };
}

/** Con menos de 12 meses con datos, el factor es 1. */
export function seasonFactor(monthCounts: number[], month: number): number {
  const active = monthCounts.filter((count) => count > 0).length;
  if (active < 12) return 1;
  const mean = monthCounts.reduce((sum, count) => sum + count, 0) / 12;
  if (mean <= 0) return 1;
  const count = monthCounts[month] ?? 0;
  return count / mean || 1;
}

export function eventMultiplier(events: HouseholdEventWindow[], date: Date): number {
  let factor = 1;
  for (const event of events) {
    if (event.isActive === false) continue;
    if (!eventCovers(event, date)) continue;
    factor *= event.multiplier;
  }
  return Math.max(0, factor);
}

function eventCovers(event: HouseholdEventWindow, date: Date): boolean {
  if (event.startsAt || event.endsAt) {
    const start = event.startsAt ? asDate(event.startsAt).getTime() : Number.NEGATIVE_INFINITY;
    const end = event.endsAt ? asDate(event.endsAt).getTime() : Number.POSITIVE_INFINITY;
    return date.getTime() >= start && date.getTime() <= end;
  }
  if (event.month && event.day) {
    return date.getUTCMonth() + 1 === event.month && date.getUTCDate() === event.day;
  }
  return false;
}

function bufferFor(confidence: Confidence, base = DEFAULT_BUFFER_DAYS): number {
  const buffer = base ?? DEFAULT_BUFFER_DAYS;
  if (confidence === 'baja' || confidence === 'insuficiente') return buffer + 2;
  return buffer;
}

function confidenceOf(purchases: number, sd: number, mu: number): Confidence {
  if (purchases < 1 || mu <= 0) return 'insuficiente';
  const cv = sd / mu;
  if (purchases >= 5 && cv < 0.45) return 'alta';
  if (cv > 0.8) return 'baja';
  if (purchases >= 3) return 'media';
  return 'baja';
}

function toBase(quantity: number, rawUnit: string): { amount: number; unit: BaseUnit } | null {
  const unit = rawUnit.toLowerCase();
  if (unit === 'kg') return { amount: quantity, unit: 'kg' };
  if (unit === 'g' || unit === 'gr' || unit === 'grs') return { amount: quantity / 1000, unit: 'kg' };
  if (unit === 'l' || unit === 'lt' || unit === 'litro' || unit === 'litros') return { amount: quantity, unit: 'L' };
  if (unit === 'ml' || unit === 'cc') return { amount: quantity / 1000, unit: 'L' };
  if (unit === 'un' || unit === 'und' || unit === 'uds' || unit === 'pack') return { amount: quantity, unit: 'un' };
  return null;
}

export function purchaseAmount(event: PurchaseEvent): { amount: number; unit: BaseUnit } {
  if (event.baseAmount != null && event.baseAmount > 0 && event.baseUnit) {
    const direct = toBase(event.baseAmount, event.baseUnit);
    if (direct) return direct;
  }
  const packs = event.quantity > 0 ? event.quantity : 1;
  if (event.unit) {
    const direct = toBase(packs, event.unit);
    if (direct && direct.unit !== 'un') return direct;
  }
  const sizes = [...event.productName.matchAll(SIZE_TOKEN)]
    .map((match) => {
      const rawAmount = match[1];
      const rawUnit = match[2];
      if (!rawAmount || !rawUnit) return null;
      return toBase(Number(rawAmount.replace(',', '.')), rawUnit);
    })
    .filter((size): size is { amount: number; unit: BaseUnit } => Boolean(size));
  const measured = sizes.filter((size) => size.unit !== 'un');
  const size = measured[measured.length - 1] || sizes[sizes.length - 1];
  if (size && !(event.unit && toBase(1, event.unit)?.unit === size.unit && toBase(1, event.unit)?.unit !== 'un')) {
    return { amount: size.amount * packs, unit: size.unit };
  }
  if (event.unit) {
    const direct = toBase(packs, event.unit);
    if (direct) return direct;
  }
  return { amount: packs, unit: 'un' };
}

/**
 * baseAmount = cantidad × tamaño × pack del canónico.
 * A granel se usa el peso cobrado, no un pack.
 */
export function baseAmountFromCatalog(
  quantity: number,
  unit: string | null | undefined,
  productName: string,
  canonical?: {
    sizeAmount?: number | null;
    sizeUnit?: string | null;
    packCount?: number | null;
    soldByWeight?: boolean | null;
  } | null,
): { baseAmount: number; baseUnit: BaseUnit } {
  const packs = quantity > 0 ? quantity : 1;
  if (canonical?.soldByWeight) {
    if (unit) {
      const weighed = toBase(packs, unit);
      if (weighed && weighed.unit === 'kg') return { baseAmount: weighed.amount, baseUnit: 'kg' };
    }
    return { baseAmount: packs, baseUnit: 'kg' };
  }
  if (canonical?.sizeAmount && canonical.sizeAmount > 0) {
    const packCount = canonical.packCount && canonical.packCount > 0 ? canonical.packCount : 1;
    const sizeUnit = canonical.sizeUnit || 'un';
    if (sizeUnit === 'ml') return { baseAmount: packs * (canonical.sizeAmount / 1000) * packCount, baseUnit: 'L' };
    if (sizeUnit === 'g') return { baseAmount: packs * (canonical.sizeAmount / 1000) * packCount, baseUnit: 'kg' };
    return { baseAmount: packs * canonical.sizeAmount * packCount, baseUnit: 'un' };
  }
  const parsed = purchaseAmount({ productName, quantity: packs, unit, purchasedAt: new Date() });
  return { baseAmount: parsed.amount, baseUnit: parsed.unit };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

function displayLabel(name: string): string {
  return name.replace(SIZE_TOKEN, ' ').replace(/\s+/g, ' ').trim();
}

function formatAmount(amount: number, unit: BaseUnit): string {
  const rounded = Math.round(amount * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return `${text} ${unit}`;
}

function formatDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  return `${date.getUTCDate()}/${MONTHS[date.getUTCMonth()]}`;
}

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  insuficiente: 'Confianza insuficiente.',
  baja: 'Confianza baja.',
  media: 'Confianza media.',
  alta: 'Confianza alta.',
};

export function forecastProducts(events: PurchaseEvent[], now = new Date(), options: ForecastOptions = {}): ProductForecast[] {
  const grouped = new Map<string, PurchaseEvent[]>();
  for (const event of events) {
    const key = event.groupKey || householdGroupKey(event.productName);
    const list = grouped.get(key) || [];
    list.push(event);
    grouped.set(key, list);
  }

  const forecasts: ProductForecast[] = [];
  for (const [key, rows] of grouped) {
    const ordered = [...rows].sort((a, b) => asDate(a.purchasedAt).getTime() - asDate(b.purchasedAt).getTime());
    const sampleName = ordered[ordered.length - 1]?.productName || key;
    const prior = priorFor(sampleName);
    let profile = emptyProfile(prior.unit);
    const history: PurchasePoint[] = [];
    for (const row of ordered) {
      const measured = purchaseAmount(row);
      profile = applyPurchase(profile, {
        at: row.purchasedAt,
        amount: measured.amount,
        leftover: row.leftover ?? 0,
      }, options);
      profile.unit = measured.unit;
      const at = asDate(row.purchasedAt);
      const previous = history[history.length - 1];
      if (previous && previous.date === dayKey(at)) {
        previous.amount = Math.round((previous.amount + measured.amount) * 1000) / 1000;
        previous.label = row.productName;
        previous.storeName = row.storeName || previous.storeName;
      } else {
        history.push({
          date: dayKey(at),
          amount: Math.round(measured.amount * 1000) / 1000,
          unit: measured.unit,
          storeName: row.storeName,
          price: row.price,
          label: row.productName,
        });
      }
    }
    const label = displayLabel(sampleName) || key;
    const unit = profile.unit;
    const coverage = coverageOf(profile, now, { ...options, priorPerDay: coldStartRate(prior.perPersonDay, options.equivalents ?? 1) });
    const last = history[history.length - 1];
    const daysRounded = coverage && Number.isFinite(coverage.daysLeft) ? Math.round(coverage.daysLeft) : null;
    const alert = Boolean(coverage?.alert);
    const urgency: ProductForecast['urgency'] = profile.frozen
      ? 'none'
      : alert
        ? (daysRounded != null && daysRounded <= 0 ? 'add_now' : 'add_soon')
        : daysRounded != null && daysRounded <= 14
          ? 'monitor'
          : 'none';
    const confidence = coverage?.confidence || profile.confidence;
    let message: string;
    if (profile.frozen) {
      message = `${label}: no lo compras más. No voy a avisar.`;
    } else if (!last || !coverage) {
      message = `${label}: ${CONFIDENCE_TEXT.insuficiente}`;
    } else if (profile.nPurchases < 2) {
      message = `Tu ${label} se acaba en ~${daysRounded} ${daysRounded === 1 ? 'día' : 'días'}. Es un cálculo inicial con el prior de la categoría, con una sola compra. ${CONFIDENCE_TEXT.baja}`;
    } else if (daysRounded == null) {
      message = `${label}: el consumo está en pausa por un evento de la familia. ${CONFIDENCE_TEXT[confidence]}`;
    } else if (daysRounded <= 0) {
      message = `Tu ${label} ya se habría acabado; la última vez compraste ${formatAmount(last.amount, unit)} el ${formatDay(last.date)}. ${CONFIDENCE_TEXT[confidence]}`;
    } else {
      message = `Tu ${label} se acaba en ~${daysRounded} ${daysRounded === 1 ? 'día' : 'días'}; la última vez compraste ${formatAmount(last.amount, unit)} el ${formatDay(last.date)}. ${CONFIDENCE_TEXT[confidence]}`;
    }

    forecasts.push({
      key,
      identity: productIdentity(sampleName),
      label,
      unit,
      purchases: history.length,
      confidence,
      weeklyAmount: coverage && Number.isFinite(coverage.ratePerDay) ? Math.round(coverage.ratePerDay * 7 * 10) / 10 : null,
      daysLeft: daysRounded,
      predictedDate: coverage ? dayKey(coverage.runOut) : null,
      lastAmount: last ? last.amount : null,
      lastDate: last ? last.date : null,
      lastStore: last?.storeName || null,
      history,
      alert,
      urgency,
      message,
      suggestedQuantity: Math.max(1, Math.round(last?.amount || 1)),
      ratePerDay: coverage ? Math.round(coverage.ratePerDay * 1000) / 1000 : null,
      estStock: coverage ? Math.round(coverage.stock * 1000) / 1000 : null,
      pessimisticDays: coverage && Number.isFinite(coverage.pessimisticDays) ? Math.round(coverage.pessimisticDays * 10) / 10 : null,
      runOutEarly: coverage ? dayKey(coverage.early) : null,
      runOutLate: coverage ? dayKey(coverage.late) : null,
      frozen: profile.frozen,
    });
  }

  const order = { add_now: 0, add_soon: 1, monitor: 2, none: 3 };
  return forecasts.sort((a, b) => order[a.urgency] - order[b.urgency] || a.label.localeCompare(b.label, 'es'));
}
