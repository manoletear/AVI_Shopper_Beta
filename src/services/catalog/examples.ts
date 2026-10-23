/**
 * Ejemplos chilenos para la prueba de precisión y para el seed.
 * La ficha de la derecha tiene que caer en el id de la izquierda.
 */

export interface LabeledProduct {
  id: string;
  name: string;
  ean?: string;
  minPurchase?: number;
  stepAmount?: number;
}

export interface LabeledCase {
  rawName: string;
  ean?: string;
  store: string;
  expect: string | null;
}

export const LABELED_PRODUCTS: LabeledProduct[] = [
  { id: 'soprole-1', name: 'Leche Soprole Entera 1 L', ean: '7802900000011' },
  { id: 'soprole-6', name: 'Leche Soprole Entera 6x1 L', ean: '7802900000066' },
  { id: 'colun-1', name: 'Leche Colun 1 L', ean: '7801234000018' },
  { id: 'soprole-desc', name: 'Leche Soprole Descremada 1 L' },
  { id: 'pan-int', name: 'Pan molde Ideal integral 580 g' },
  { id: 'pan-blanco', name: 'Pan molde Ideal blanco 580 g' },
  { id: 'lomo-granel', name: 'Lomo vetado Cat-V granel', minPurchase: 0.5, stepAmount: 0.1 },
  { id: 'lomo-vacio', name: 'Lomo vetado Cat-V al vacío 500 g' },
  { id: 'entrana', name: 'Entraña', minPurchase: 0.5, stepAmount: 0.1 },
  { id: 'entranita', name: 'Entrañita', minPurchase: 0.5, stepAmount: 0.1 },
  { id: 'carbon', name: 'Carbón vegetal 2,5 kg' },
  { id: 'papel', name: 'Papel higiénico Elite 12 rollos' },
];

export const LABELED_CASES: LabeledCase[] = [
  { rawName: 'Leche Entera Soprole 1L', store: 'lider', expect: 'soprole-1' },
  { rawName: 'Leche Soprole Entera 1 L', store: 'jumbo', expect: 'soprole-1' },
  { rawName: 'Leche rara 1L', ean: '7802900000011', store: 'unimarc', expect: 'soprole-1' },
  { rawName: 'Papel Higienico Elite 12 un', store: 'jumbo', expect: 'papel' },
  { rawName: 'Carbon Vegetal 2.5kg', store: 'tottus', expect: 'carbon' },
  { rawName: 'Pan de molde integral Ideal 580g', store: 'lider', expect: 'pan-int' },
  { rawName: 'Lomo vetado categoria V a granel', store: 'jumbo', expect: 'lomo-granel' },
  { rawName: 'Leche Colun 1L', store: 'lider', expect: 'colun-1' },
  { rawName: 'Leche Soprole Entera 6x1L', store: 'tottus', expect: 'soprole-6' },
  { rawName: 'Leche Soprole Descremada 1L', store: 'jumbo', expect: 'soprole-desc' },
  { rawName: 'Lomo vetado Cat-V al vacio 500g', store: 'lider', expect: 'lomo-vacio' },
  { rawName: 'Entraña', store: 'lider', expect: 'entrana' },
  { rawName: 'Entrañita', store: 'tottus', expect: 'entranita' },
  { rawName: 'Pan molde Ideal blanco', store: 'unimarc', expect: 'pan-blanco' },
  { rawName: 'Yerba mate Canarias 1 kg', store: 'jumbo', expect: null },
];

export const SUBSTITUTE_PAIRS: Array<{ from: string; to: string; reason: string; note: string }> = [
  { from: 'soprole-1', to: 'colun-1', reason: 'otra marca', note: 'Entera Soprole y Colun 1 L se pueden cambiar si falta una.' },
  { from: 'soprole-1', to: 'soprole-6', reason: 'otro formato', note: 'El sixpack no es la caja de 1 L.' },
  { from: 'lomo-granel', to: 'lomo-vacio', reason: 'otro formato', note: 'Granel y al vacío no se comparan por el mismo precio.' },
];
