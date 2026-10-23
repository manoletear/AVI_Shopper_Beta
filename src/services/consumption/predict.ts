/**
 * Predice cuándo se acaba un producto a partir de las compras del hogar.
 * Con una sola compra no avisa. Los saltos raros no mandan el promedio.
 * La leche se agrupa por marca y variante, no por el orden de las palabras.
 */

import { consumptionKey, productIdentity } from '../catalog/normalize';

export type BaseUnit = 'kg' | 'L' | 'un';
export type Confidence = 'insuficiente' | 'baja' | 'media' | 'alta';

export interface PurchaseEvent {
  productName: string;
  quantity: number;
  unit?: string | null;
  purchasedAt: Date | string;
  price?: number | null;
  storeName?: string | null;
  storeSlug?: string | null;
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
}

const SIZE_TOKEN = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros|un|und|uds)\b/gi;

export function productKey(name: string): string {
  return consumptionKey(name);
}

function displayLabel(name: string): string {
  return name.replace(SIZE_TOKEN, ' ').replace(/\s+/g, ' ').trim();
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
  const packs = event.quantity > 0 ? event.quantity : 1;
  if (event.unit) {
    const direct = toBase(packs, event.unit);
    if (direct && direct.unit !== 'un') return direct;
  }
  const sizes = [...event.productName.matchAll(SIZE_TOKEN)]
    .map((match) => toBase(Number(match[1].replace(',', '.')), match[2]))
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

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatAmount(amount: number, unit: BaseUnit): string {
  const rounded = Math.round(amount * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return `${text} ${unit}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  return `${date.getUTCDate()}/${MONTHS[date.getUTCMonth()]}`;
}

function confidenceOf(purchaseCount: number, gaps: number[]): Confidence {
  if (purchaseCount < 2) return 'insuficiente';
  if (purchaseCount === 2) return 'baja';
  if (gaps.length < 2) return 'baja';
  const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const variance = gaps.reduce((sum, gap) => sum + (gap - avg) ** 2, 0) / gaps.length;
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
  if (purchaseCount >= 5 && cv < 0.45) return 'alta';
  if (cv > 0.8) return 'baja';
  return 'media';
}

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  insuficiente: 'Confianza insuficiente: con una compra no estimo cuándo se acaba.',
  baja: 'Confianza baja.',
  media: 'Confianza media.',
  alta: 'Confianza alta.',
};

export function forecastProducts(events: PurchaseEvent[], now = new Date()): ProductForecast[] {
  const grouped = new Map<string, Array<PurchaseEvent & { at: Date; measured: { amount: number; unit: BaseUnit } }>>();
  for (const event of events) {
    const at = new Date(event.purchasedAt);
    if (Number.isNaN(at.getTime())) continue;
    const key = productKey(event.productName);
    if (!key) continue;
    const measured = purchaseAmount(event);
    const list = grouped.get(key) || [];
    list.push({ ...event, at, measured });
    grouped.set(key, list);
  }

  const forecasts: ProductForecast[] = [];
  for (const [key, rows] of grouped) {
    rows.sort((a, b) => a.at.getTime() - b.at.getTime());
    const unit = rows[rows.length - 1].measured.unit;
    const sameUnit = rows.filter((row) => row.measured.unit === unit);
    const merged: Array<{ at: Date; amount: number; storeName?: string | null; price?: number | null; label: string }> = [];
    for (const row of sameUnit) {
      const amount = row.measured.amount;
      const previous = merged[merged.length - 1];
      if (previous && dayKey(previous.at) === dayKey(row.at)) {
        previous.amount += amount;
        previous.label = row.productName;
        previous.storeName = row.storeName || previous.storeName;
        continue;
      }
      merged.push({
        at: row.at,
        amount,
        storeName: row.storeName,
        price: row.price,
        label: row.productName,
      });
    }

    const history: PurchasePoint[] = merged.map((row) => ({
      date: dayKey(row.at),
      amount: Math.round(row.amount * 1000) / 1000,
      unit,
      storeName: row.storeName,
      price: row.price,
      label: row.label,
    }));
    const label = displayLabel(merged[merged.length - 1].label) || key;
    const gaps: number[] = [];
    const rates: number[] = [];
    for (let i = 1; i < merged.length; i++) {
      const gap = daysBetween(merged[i - 1].at, merged[i].at);
      if (gap > 0) {
        gaps.push(gap);
        rates.push(merged[i - 1].amount / gap);
      }
    }
    const confidence = confidenceOf(merged.length, gaps);
    const last = merged[merged.length - 1];
    const daily = rates.length ? median(rates) : null;
    const daysSince = daysBetween(last.at, now);
    const supply = daily && daily > 0 ? last.amount / daily : null;
    const daysLeft = supply == null ? null : Math.round(supply - daysSince);
    const predicted = daysLeft == null ? null : new Date(now.getTime() + daysLeft * 86_400_000);
    const weekly = daily == null ? null : Math.round(daily * 7 * 10) / 10;
    const alert = confidence !== 'insuficiente' && daysLeft != null && daysLeft <= 3;
    const urgency: ProductForecast['urgency'] = !alert
      ? (confidence !== 'insuficiente' && daysLeft != null && daysLeft <= 14 ? 'monitor' : 'none')
      : daysLeft != null && daysLeft <= 0
        ? 'add_now'
        : 'add_soon';

    let message: string;
    if (confidence === 'insuficiente') {
      message = `${label}: ${CONFIDENCE_TEXT.insuficiente}`;
    } else if (daysLeft == null) {
      message = `${label}: todavía no puedo ver el ritmo. ${CONFIDENCE_TEXT[confidence]}`;
    } else if (daysLeft <= 0) {
      message = `Tu ${label} ya se habría acabado; la última vez compraste ${formatAmount(last.amount, unit)} el ${formatDay(dayKey(last.at))}. ${CONFIDENCE_TEXT[confidence]}`;
    } else {
      message = `Tu ${label} se acaba en ~${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}; la última vez compraste ${formatAmount(last.amount, unit)} el ${formatDay(dayKey(last.at))}. ${CONFIDENCE_TEXT[confidence]}`;
    }

    forecasts.push({
      key,
      identity: productIdentity(merged[merged.length - 1].label),
      label,
      unit,
      purchases: merged.length,
      confidence,
      weeklyAmount: weekly,
      daysLeft,
      predictedDate: predicted ? dayKey(predicted) : null,
      lastAmount: Math.round(last.amount * 1000) / 1000,
      lastDate: dayKey(last.at),
      lastStore: last.storeName || null,
      history,
      alert,
      urgency,
      message,
      suggestedQuantity: Math.max(1, Math.round(last.amount)),
    });
  }

  const order = { add_now: 0, add_soon: 1, monitor: 2, none: 3 };
  return forecasts.sort((a, b) => order[a.urgency] - order[b.urgency] || a.label.localeCompare(b.label, 'es'));
}
