/**
 * Precio efectivo de una oferta.
 * El número de la ficha no es lo que se paga: hay mínimos por peso,
 * formatos más chicos que lo pedido, stock y despacho.
 * El más barato sale solo entre ofertas del mismo producto.
 */

import { tagOffers } from './catalog/compare';
import { ProposalConstraints } from './household/constraints';

export type BaseUnit = 'kg' | 'L' | 'un';

export interface RawOffer {
  name: string;
  store: string;
  price: number;
  inStock?: boolean;
  stock?: number | null;
  minAmount?: number | null;
  stepAmount?: number | null;
  packageAmount?: number | null;
  packageUnit?: BaseUnit | null;
  soldByWeight?: boolean | null;
}

export interface PricedOffer extends RawOffer {
  payable: number;
  boughtAmount: number;
  boughtUnit: BaseUnit;
  requestedAmount: number;
  requestedUnit: BaseUnit;
  matched: boolean;
  comparable: boolean;
  note: string;
  isBest: boolean;
  catalogRelation?: 'same' | 'substitute' | 'other';
  catalogReason?: string;
  pricePerUnitLabel?: string | null;
}

export const STORE_DELIVERY_CLP: Record<string, number> = {
  Jumbo: 2990,
  Lider: 990,
  Unimarc: 2790,
  Tottus: 2990,
  'Santa Isabel': 3490,
};

const BUTCHER_CUT = /lomo vetado|lomo liso|entraña|entrana|asado de tira|posta|plateada|filete|osobuco|paleta|chuleta|costillar|molida|punta de ganso|sobrecostilla|tapapecho|huachalomo|pollo ganso|pechuga deshuesada/i;

const SIZE_TOKEN = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros|un|und|uds)\b/gi;
const PACK_TIMES = /(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros)/i;

interface ParsedSize {
  amount: number;
  unit: BaseUnit;
}

function toBase(amount: number, rawUnit: string): ParsedSize | null {
  const unit = rawUnit.toLowerCase();
  if (unit === 'kg') return { amount, unit: 'kg' };
  if (unit === 'g' || unit === 'gr' || unit === 'grs') return { amount: amount / 1000, unit: 'kg' };
  if (unit === 'l' || unit === 'lt' || unit === 'litro' || unit === 'litros') return { amount, unit: 'L' };
  if (unit === 'ml' || unit === 'cc') return { amount: amount / 1000, unit: 'L' };
  if (unit === 'un' || unit === 'und' || unit === 'uds') return { amount, unit: 'un' };
  return null;
}

export function parsePackageSize(name: string): ParsedSize | null {
  const times = name.match(PACK_TIMES);
  if (times) {
    const count = times[1];
    const amount = times[2];
    const unit = times[3];
    if (!count || !amount || !unit) return null;
    const each = toBase(Number(amount.replace(',', '.')), unit);
    if (!each) return null;
    return { amount: Number(count) * each.amount, unit: each.unit };
  }
  const tokens = [...name.matchAll(SIZE_TOKEN)]
    .map((match) => {
      const amount = match[1];
      const unit = match[2];
      if (!amount || !unit) return null;
      return toBase(Number(amount.replace(',', '.')), unit);
    })
    .filter((size): size is ParsedSize => Boolean(size));
  const measured = tokens.filter((size) => size.unit !== 'un');
  return (measured.length ? measured[measured.length - 1] : tokens[tokens.length - 1]) || null;
}

export function parseRequestedAmount(query: string): ParsedSize | null {
  const times = query.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|lt|litro|litros|un|und)\b/i);
  if (!times) return null;
  const amount = times[1];
  const unit = times[2];
  if (!amount || !unit) return null;
  return toBase(Number(amount.replace(',', '.')), unit);
}

function isOpenWeight(name: string, explicit?: boolean | null): boolean {
  if (explicit) return true;
  if (/por\s*kg|\/\s*kg|al\s*kg/i.test(name)) return true;
  if (parsePackageSize(name)) return false;
  return BUTCHER_CUT.test(name);
}

function storeWeightRule(store: string): { min: number; step: number } {
  if (store.toLowerCase() === 'tottus') return { min: 1.5, step: 0.5 };
  return { min: 0.5, step: 0.1 };
}

function roundUp(amount: number, min: number, step: number): number {
  const base = Math.max(amount, min);
  if (step <= 0) return roundMeasure(base);
  const steps = Math.ceil((base - min) / step - 1e-9);
  return roundMeasure(min + Math.max(0, steps) * step);
}

function roundMeasure(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatAmount(amount: number, unit: BaseUnit): string {
  const text = Number.isInteger(amount) ? String(amount) : String(amount).replace('.', ',');
  return `${text} ${unit}`;
}

function defaultRequest(offers: RawOffer[]): ParsedSize {
  if (offers.some((offer) => isOpenWeight(offer.name, offer.soldByWeight))) {
    return { amount: 1, unit: 'kg' };
  }
  const sized = offers
    .map((offer) => offer.packageUnit && offer.packageAmount
      ? { amount: offer.packageAmount, unit: offer.packageUnit }
      : parsePackageSize(offer.name))
    .filter((size): size is ParsedSize => Boolean(size));
  return sized[0] || { amount: 1, unit: 'un' };
}

export function priceQuery<T extends RawOffer>(query: string, offers: T[], constraints?: ProposalConstraints): {
  requestLabel: string;
  lines: Array<T & PricedOffer>;
  cheapest: (T & PricedOffer) | null;
} {
  const request = parseRequestedAmount(query) || defaultRequest(offers);
  const tags = tagOffers(query, offers, constraints);
  const lines = offers.map((offer, index) => {
    const priced = priceOne(offer, request);
    const tag = tags[index];
    if (!tag) {
      return {
        ...priced,
        matched: false,
        comparable: false,
        note: 'No es el mismo producto',
        catalogRelation: 'other' as const,
        catalogReason: '',
        pricePerUnitLabel: null,
      };
    }
    if (tag.relation === 'other') {
      return {
        ...priced,
        matched: false,
        comparable: false,
        note: 'No es el mismo producto',
        catalogRelation: tag.relation,
        catalogReason: tag.reason,
        pricePerUnitLabel: tag.pricePerUnitLabel,
      };
    }
    return {
      ...priced,
      comparable: tag.relation === 'same',
      catalogRelation: tag.relation,
      catalogReason: tag.reason,
      pricePerUnitLabel: tag.pricePerUnitLabel,
    };
  });
  const eligible = lines.filter((line) => line.comparable && line.matched && line.inStock !== false);
  const best = eligible.reduce<(T & PricedOffer) | null>((winner, line) => {
    if (!winner || line.payable < winner.payable) return line;
    return winner;
  }, null);
  const marked = lines.map((line) => ({
    ...line,
    isBest: Boolean(best && line.store === best.store && line.name === best.name && line.payable === best.payable),
  }));
  return {
    requestLabel: formatAmount(request.amount, request.unit),
    lines: marked,
    cheapest: marked.find((line) => line.isBest) || null,
  };
}

function priceOne<T extends RawOffer>(offer: T, request: ParsedSize): T & PricedOffer {
  const inStock = offer.inStock !== false;
  const open = isOpenWeight(offer.name, offer.soldByWeight);
  const pack = !open
    ? (offer.packageAmount && offer.packageUnit
      ? { amount: offer.packageAmount, unit: offer.packageUnit }
      : parsePackageSize(offer.name))
    : null;

  const fail = (note: string, unit: BaseUnit = request.unit): T & PricedOffer => ({
    ...offer,
    payable: offer.price,
    boughtAmount: 0,
    boughtUnit: unit,
    requestedAmount: request.amount,
    requestedUnit: request.unit,
    matched: false,
    comparable: true,
    inStock,
    note,
    isBest: false,
  });

  if (!inStock) return fail('Sin stock');

  if (open) {
    if (request.unit !== 'kg') return fail('El corte se vende por kilo y el pedido está en otra unidad');
    const rule = storeWeightRule(offer.store);
    const min = offer.minAmount ?? rule.min;
    const step = offer.stepAmount ?? rule.step;
    const bought = roundUp(request.amount, min, step);
    const payable = Math.round(offer.price * bought);
    const raised = bought - request.amount > 0.001;
    return {
      ...offer,
      payable,
      boughtAmount: bought,
      boughtUnit: 'kg',
      requestedAmount: request.amount,
      requestedUnit: 'kg',
      matched: true,
      comparable: true,
      inStock,
      note: raised
        ? `Mínimo ${formatAmount(min, 'kg')}. Para ${formatAmount(request.amount, 'kg')} llevas ${formatAmount(bought, 'kg')} y pagas $${payable.toLocaleString('es-CL')}. El kilo está a $${offer.price.toLocaleString('es-CL')}.`
        : `Pagas ${formatAmount(bought, 'kg')} a $${offer.price.toLocaleString('es-CL')} el kilo.`,
      isBest: false,
    };
  }

  if (!pack) {
    if (request.unit !== 'un') return fail('No sé el formato, así que no puedo calcular lo pedido');
    const packs = Math.ceil(request.amount);
    if (offer.stock != null && packs > offer.stock) return fail('No alcanza el stock para la cantidad pedida', 'un');
    return {
      ...offer,
      payable: offer.price * packs,
      boughtAmount: packs,
      boughtUnit: 'un',
      requestedAmount: request.amount,
      requestedUnit: 'un',
      matched: true,
      comparable: true,
      inStock,
      note: '',
      isBest: false,
    };
  }

  if (pack.unit !== request.unit) return fail('El formato no calza con la unidad pedida', pack.unit);
  const packs = Math.max(1, Math.ceil(request.amount / pack.amount - 1e-9));
  if (offer.stock != null && packs > offer.stock) return fail('No alcanza el stock para la cantidad pedida', pack.unit);
  const bought = roundMeasure(packs * pack.amount);
  const payable = offer.price * packs;
  const extra = bought - request.amount > 0.001;
  return {
    ...offer,
    payable,
    boughtAmount: bought,
    boughtUnit: pack.unit,
    requestedAmount: request.amount,
    requestedUnit: request.unit,
    matched: true,
    comparable: true,
    inStock,
    note: extra
      ? `El formato es de ${formatAmount(pack.amount, pack.unit)}. Para ${formatAmount(request.amount, pack.unit)} llevas ${packs} (${formatAmount(bought, pack.unit)}).`
      : packs > 1
        ? `${packs} unidades de ${formatAmount(pack.amount, pack.unit)}.`
        : '',
    isBest: false,
  };
}

export interface BasketLine {
  query: string;
  lines: PricedOffer[];
}

export interface StoreBasket {
  store: string;
  items: Array<{ query: string; name: string; payable: number; note: string }>;
  missing: string[];
  subtotal: number;
  delivery: number;
  total: number;
  complete: boolean;
}

export function priceBaskets(queries: BasketLine[], fees: Record<string, number> = STORE_DELIVERY_CLP): StoreBasket[] {
  const stores = new Set<string>();
  for (const query of queries) {
    for (const line of query.lines) stores.add(line.store);
  }
  const baskets: StoreBasket[] = [];
  for (const store of stores) {
    const items: StoreBasket['items'] = [];
    const missing: string[] = [];
    for (const query of queries) {
      const choices = query.lines.filter((line) => line.store === store && line.matched && line.inStock !== false && line.comparable !== false);
      const best = choices.reduce<PricedOffer | null>((winner, line) => (!winner || line.payable < winner.payable ? line : winner), null);
      if (!best) {
        missing.push(query.query);
        continue;
      }
      items.push({ query: query.query, name: best.name, payable: best.payable, note: best.note });
    }
    const subtotal = items.reduce((sum, item) => sum + item.payable, 0);
    const delivery = fees[store] ?? 2990;
    baskets.push({
      store,
      items,
      missing,
      subtotal,
      delivery,
      total: subtotal + (items.length ? delivery : 0),
      complete: missing.length === 0 && items.length === queries.length,
    });
  }
  return baskets.sort((a, b) => a.total - b.total);
}
