/**
 * Junta en un solo carro lo que se acaba en la misma ventana.
 * Si no llega al mínimo de la tienda, adelanta los siguientes.
 * El carro queda propuesto. AVI no paga ni hace el pedido.
 */

import { STORE_DELIVERY_CLP } from '../offer-pricing';

const DAY = 86_400_000;

export const STORE_MIN_ORDER_CLP: Record<string, number> = {
  Jumbo: 15000,
  Lider: 10000,
  Unimarc: 8000,
  Tottus: 12000,
};

export const STORE_LEAD_DAYS: Record<string, number> = {
  Jumbo: 2,
  Lider: 1,
  Unimarc: 2,
  Tottus: 2,
};

export interface BundleOffer {
  store: string;
  name: string;
  pricePerUnit: number;
  inStock?: boolean;
  minPurchase?: number;
  step?: number;
}

export interface BundleItem {
  groupKey: string;
  name: string;
  runOutAt: Date | string;
  quantity: number;
  unit: string;
  offers: BundleOffer[];
}

export interface BundleLine {
  groupKey: string;
  name: string;
  payable: number;
  quantity: number;
  bought: number;
  unit: string;
  pulledForward: boolean;
}

export interface ProposedBundle {
  store: string;
  status: 'proposed';
  items: BundleLine[];
  subtotal: number;
  delivery: number;
  total: number;
  minOrder: number;
  meetsMinimum: boolean;
  note: string;
}

const NOTE = 'Carro propuesto para que lo apruebe quien administra la familia. AVI no paga ni hace el pedido.';

export function linePayable(quantity: number, offer: BundleOffer): { payable: number; bought: number } {
  const min = offer.minPurchase && offer.minPurchase > 0 ? offer.minPurchase : 0;
  const step = offer.step && offer.step > 0 ? offer.step : 0;
  let bought = Math.max(quantity, min);
  if (step > 0) {
    const base = Math.max(bought, min || step);
    const steps = Math.ceil((base - (min || 0)) / step - 1e-9);
    bought = (min || 0) + Math.max(0, steps) * step;
    if (min === 0) bought = Math.ceil(quantity / step - 1e-9) * step;
  }
  bought = Math.round(bought * 1000) / 1000;
  return { payable: Math.round(offer.pricePerUnit * bought), bought };
}

function at(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

export function splitWindow(items: BundleItem[], now: Date, leadDays: number, bufferDays: number, extraDays = 7): { due: BundleItem[]; later: BundleItem[] } {
  const horizon = now.getTime() + (leadDays + bufferDays + extraDays) * DAY;
  const due: BundleItem[] = [];
  const later: BundleItem[] = [];
  for (const item of items) {
    if (at(item.runOutAt) <= horizon) due.push(item);
    else later.push(item);
  }
  due.sort((a, b) => at(a.runOutAt) - at(b.runOutAt));
  later.sort((a, b) => at(a.runOutAt) - at(b.runOutAt));
  return { due, later };
}

function offerFor(item: BundleItem, store: string): BundleOffer | null {
  const found = item.offers.find((offer) => offer.store === store && offer.inStock !== false && offer.pricePerUnit > 0);
  return found || null;
}

interface PricedStore {
  store: string;
  lines: BundleLine[];
  missing: number;
  subtotal: number;
  delivery: number;
  total: number;
  minOrder: number;
  meetsMinimum: boolean;
}

function priceStore(
  store: string,
  due: BundleItem[],
  later: BundleItem[],
  minimums: Record<string, number>,
  deliveryFees: Record<string, number>,
): PricedStore | null {
  const lines: BundleLine[] = [];
  let missing = 0;
  for (const item of due) {
    const offer = offerFor(item, store);
    if (!offer) {
      missing += 1;
      continue;
    }
    const priced = linePayable(item.quantity, offer);
    lines.push({
      groupKey: item.groupKey,
      name: offer.name || item.name,
      payable: priced.payable,
      quantity: item.quantity,
      bought: priced.bought,
      unit: item.unit,
      pulledForward: false,
    });
  }
  if (!lines.length) return null;
  const minOrder = minimums[store] ?? 10000;
  const queue = [...later];
  while (lines.reduce((sum, line) => sum + line.payable, 0) < minOrder && queue.length) {
    const next = queue.shift()!;
    const offer = offerFor(next, store);
    if (!offer) continue;
    const priced = linePayable(next.quantity, offer);
    lines.push({
      groupKey: next.groupKey,
      name: offer.name || next.name,
      payable: priced.payable,
      quantity: next.quantity,
      bought: priced.bought,
      unit: next.unit,
      pulledForward: true,
    });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.payable, 0);
  const delivery = deliveryFees[store] ?? STORE_DELIVERY_CLP[store] ?? 2990;
  return {
    store,
    lines,
    missing,
    subtotal,
    delivery,
    total: subtotal + delivery,
    minOrder,
    meetsMinimum: subtotal >= minOrder && missing === 0,
  };
}

export function bundleCart(
  items: BundleItem[],
  options: {
    now?: Date;
    leadDays?: number;
    bufferDays?: number;
    extraDays?: number;
    minimums?: Record<string, number>;
    delivery?: Record<string, number>;
  } = {},
): ProposedBundle | null {
  const now = options.now ?? new Date();
  const leadDays = options.leadDays ?? DEFAULT_LEAD;
  const bufferDays = options.bufferDays ?? 2;
  const { due, later } = splitWindow(items, now, leadDays, bufferDays, options.extraDays ?? 7);
  if (!due.length) return null;
  const stores = new Set<string>();
  for (const item of [...due, ...later]) {
    for (const offer of item.offers) {
      if (offer.inStock !== false) stores.add(offer.store);
    }
  }
  const minimums = { ...STORE_MIN_ORDER_CLP, ...options.minimums };
  const delivery = { ...STORE_DELIVERY_CLP, ...options.delivery };
  const priced = [...stores]
    .map((store) => priceStore(store, due, later, minimums, delivery))
    .filter((row): row is PricedStore => Boolean(row));
  if (!priced.length) return null;
  priced.sort((a, b) => {
    if (a.meetsMinimum !== b.meetsMinimum) return a.meetsMinimum ? -1 : 1;
    if (a.missing !== b.missing) return a.missing - b.missing;
    return a.total - b.total;
  });
  const best = priced[0];
  return {
    store: best.store,
    status: 'proposed',
    items: best.lines,
    subtotal: best.subtotal,
    delivery: best.delivery,
    total: best.total,
    minOrder: best.minOrder,
    meetsMinimum: best.meetsMinimum,
    note: NOTE,
  };
}

const DEFAULT_LEAD = 2;
