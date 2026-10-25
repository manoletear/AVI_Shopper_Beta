/**
 * Lee un nombre de góndola chilena y lo deja en gramos, mililitros o unidades.
 * El mismo texto con otro orden de palabras cae en la misma ficha.
 */

export type SizeUnit = 'g' | 'ml' | 'un';

export interface NormalizedProduct {
  rawName: string;
  brand: string | null;
  category: string;
  variant: string | null;
  sizeAmount: number | null;
  sizeUnit: SizeUnit | null;
  packCount: number;
  soldByWeight: boolean;
  ean: string | null;
  family: string;
  identity: string;
}

const BRANDS = [
  'soprole', 'colun', 'loncoleche', 'surlat', 'quillayes', 'calan', 'nestle',
  'ideal', 'castano', 'bimbo', 'elite', 'noble', 'confort', 'favorita',
  'agrosuper', 'ariztia', 'watts', 'cuisine & co',
];

function stripAccents(value: string): string {
  return value
    .replace(/[áàä]/gi, 'a')
    .replace(/[éèë]/gi, 'e')
    .replace(/[íìï]/gi, 'i')
    .replace(/[óòö]/gi, 'o')
    .replace(/[úùü]/gi, 'u')
    .replace(/ñ/gi, 'n');
}

export function cleanEan(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

function convert(rawAmount: string, rawUnit: string): { amount: number; unit: SizeUnit } | null {
  const amount = Number(rawAmount.replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  const unit = rawUnit.toLowerCase();
  if (unit === 'kg') return { amount: Math.round(amount * 1000), unit: 'g' };
  if (unit === 'g' || unit === 'gr' || unit === 'grs') return { amount: Math.round(amount), unit: 'g' };
  if (unit === 'l' || unit === 'lt' || unit === 'litro' || unit === 'litros') {
    return { amount: Math.round(amount * 1000), unit: 'ml' };
  }
  if (unit === 'ml' || unit === 'cc') return { amount: Math.round(amount), unit: 'ml' };
  return null;
}

function parseFormat(text: string): { packCount: number; sizeAmount: number | null; sizeUnit: SizeUnit | null } {
  const pack = text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros)\b/);
  if (pack) {
    const count = pack[1];
    const amount = pack[2];
    const unit = pack[3];
    if (count && amount && unit) {
      const each = convert(amount, unit);
      if (each) return { packCount: Number(count), sizeAmount: each.amount, sizeUnit: each.unit };
    }
  }
  const measured = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|ml|cc|lt|l|litro|litros)\b/g)];
  if (measured.length) {
    const last = measured[measured.length - 1];
    const amount = last?.[1];
    const unit = last?.[2];
    if (amount && unit) {
      const size = convert(amount, unit);
      if (size) return { packCount: 1, sizeAmount: size.amount, sizeUnit: size.unit };
    }
  }
  const count = text.match(/(\d+)\s*(rollos?|unidades|unidad|uds|und|un|hojas|latas)\b/);
  if (count) return { packCount: Number(count[1]), sizeAmount: 1, sizeUnit: 'un' };
  return { packCount: 1, sizeAmount: null, sizeUnit: null };
}

function findBrand(text: string): string | null {
  const padded = ` ${text} `;
  const sorted = [...BRANDS].sort((a, b) => b.length - a.length);
  for (const brand of sorted) {
    if (padded.includes(` ${brand} `)) return brand;
  }
  return null;
}

function meatVariant(text: string): string | null {
  const grade = /cat[\s.-]*v\b|categoria v\b/.test(text) ? 'cat-v' : '';
  const cuts: Array<[RegExp, string]> = [
    [/entranita/, 'entranita'],
    [/entrana/, 'entrana'],
    [/lomo vetado/, 'lomo vetado'],
    [/lomo liso/, 'lomo liso'],
    [/asado de tira/, 'asado de tira'],
    [/punta de ganso/, 'punta de ganso'],
    [/carne molida|\bmolida\b/, 'molida'],
  ];
  const cut = cuts.find(([pattern]) => pattern.test(text));
  if (!cut) return null;
  return [cut[1], grade].filter(Boolean).join(' ');
}

function categoryOf(text: string, variant: string | null): string {
  if (/papel higienico/.test(text)) return 'aseo';
  if (/\bcarbon\b/.test(text)) return 'carbon';
  if (/\bleche\b|\byogurt\b|\bqueso\b|\bmantequilla\b/.test(text)) return 'lacteos';
  if (/\bpan\b|\bmarraqueta\b|\bhallulla\b/.test(text)) return 'panaderia';
  if (variant || /pollo|posta|filete|osobuco|paleta|chuleta|costillar|plateada/.test(text)) return 'carnes';
  if (/\barroz\b|\bazucar\b|\bfideos\b|\bharina\b|\baceite\b|\bcafe\b/.test(text)) return 'abarrotes';
  return 'general';
}

function variantOf(text: string, category: string): string | null {
  const meat = meatVariant(text);
  if (meat) return meat;
  if (category === 'lacteos') {
    const milk = ['sin lactosa', 'semidescremada', 'descremada', 'chocolatada', 'entera']
      .find((item) => text.includes(item));
    return milk || null;
  }
  if (category === 'panaderia') {
    const form = /de molde|\bmolde\b/.test(text) ? 'molde' : /\bmarraqueta\b/.test(text) ? 'marraqueta' : /\bhallulla\b/.test(text) ? 'hallulla' : '';
    const grain = ['integral', 'centeno', 'linaza', 'blanco'].find((item) => text.includes(item)) || '';
    const variant = [form, grain].filter(Boolean).join(' ');
    return variant || null;
  }
  if (category === 'carbon') return text.includes('vegetal') ? 'vegetal' : null;
  if (category === 'aseo' && /papel higienico/.test(text)) return 'higienico';
  if (category === 'abarrotes' && /grado\s*1/.test(text)) return 'grado 1';
  return null;
}

export function normalizeName(rawName: string, ean?: string | null): NormalizedProduct {
  const text = stripAccents(rawName).toLowerCase().replace(/[^a-z0-9×x.,\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const format = parseFormat(text);
  const brand = findBrand(text);
  const category = categoryOf(text, meatVariant(text));
  const variant = variantOf(text, category);
  const explicitWeight = /\bgranel\b|por kilo|por kg|al kg|\/\s*kg/.test(text);
  const packaged = /\bvacio\b|\bbandeja\b|\benvasad/.test(text) || format.sizeAmount != null;
  const soldByWeight = explicitWeight || (Boolean(meatVariant(text)) && !packaged);
  const product: NormalizedProduct = {
    rawName,
    brand,
    category,
    variant,
    sizeAmount: soldByWeight ? null : format.sizeAmount,
    sizeUnit: soldByWeight ? null : format.sizeUnit,
    packCount: soldByWeight ? 1 : format.packCount,
    soldByWeight,
    ean: cleanEan(ean),
    family: '',
    identity: '',
  };
  product.family = [product.category, product.brand || '', product.variant || ''].join('|');
  product.identity = [
    product.family,
    product.sizeAmount ?? '',
    product.sizeUnit || '',
    product.packCount,
    product.soldByWeight ? 'peso' : 'fijo',
  ].join('|');
  return product;
}

export function consumptionKey(name: string): string {
  return normalizeName(name).family;
}

export function productIdentity(name: string): string {
  return normalizeName(name).identity;
}

export function isSpecific(product: NormalizedProduct): boolean {
  if (product.category === 'general') return false;
  const hasKind = Boolean(product.brand || product.variant);
  const hasFormat = product.soldByWeight || product.sizeAmount != null;
  return hasKind && hasFormat;
}

export function pricePerUnit(product: NormalizedProduct, price: number): { amount: number; label: string } | null {
  const money = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;
  if (product.soldByWeight) return { amount: price, label: `${money(price)} / kg` };
  if (product.sizeUnit === 'ml' && product.sizeAmount) {
    const liters = (product.sizeAmount * product.packCount) / 1000;
    if (liters <= 0) return null;
    const each = price / liters;
    return { amount: Math.round(each), label: `${money(each)} / L` };
  }
  if (product.sizeUnit === 'g' && product.sizeAmount) {
    const kilos = (product.sizeAmount * product.packCount) / 1000;
    if (kilos <= 0) return null;
    const each = price / kilos;
    return { amount: Math.round(each), label: `${money(each)} / kg` };
  }
  if (product.sizeUnit === 'un' && product.packCount > 0) {
    const each = price / product.packCount;
    return { amount: Math.round(each), label: `${money(each)} / un` };
  }
  return null;
}
