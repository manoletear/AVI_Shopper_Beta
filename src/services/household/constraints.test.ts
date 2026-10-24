import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundleCart, BundleItem } from '../consumption/bundle';
import { normalizeName } from '../catalog/normalize';
import { proposeSubstituteReason } from '../catalog/substitutes';
import { priceQuery } from '../offer-pricing';
import {
  allowsProposedItem,
  allowsSubstitution,
  isAlcoholItem,
  isAllergenItem,
} from './constraints';

const now = new Date('2026-10-24T12:00:00.000Z');

function item(partial: Partial<BundleItem> & Pick<BundleItem, 'name' | 'runOutAt' | 'offers'>): BundleItem {
  return {
    groupKey: partial.groupKey || partial.name,
    quantity: partial.quantity ?? 1,
    unit: partial.unit || 'un',
    ...partial,
  };
}

describe('restricciones del hogar', () => {
  it('bloquea alérgenos y no confunde leche vegetal ni maní con frutos secos', () => {
    assert.equal(isAllergenItem('Camarones cocidos', ['mariscos']), true);
    assert.equal(isAllergenItem('Salmón fresco', ['mariscos']), false);
    assert.equal(isAllergenItem('Salmón fresco', ['pescado']), true);
    assert.equal(isAllergenItem('Leche Colun entera 1 L', ['lacteos']), true);
    assert.equal(isAllergenItem('Leche de soya', ['lacteos']), false);
    assert.equal(isAllergenItem('Mantequilla de maní', ['frutos_secos']), false);
    assert.equal(isAllergenItem('Mantequilla de maní', ['mani']), true);
    assert.equal(isAllergenItem('Almendras', ['mani']), false);
    assert.equal(isAllergenItem('Almendras', ['frutos_secos']), true);
    assert.equal(isAllergenItem('Pan marraqueta', ['Gluten']), true);
  });

  it('el alcohol se propone solo si el hogar lo permite', () => {
    assert.equal(isAlcoholItem('Vino tinto 750 ml'), true);
    assert.equal(isAlcoholItem('Pisco sour'), true);
    assert.equal(isAlcoholItem('Vinagre de vino'), false);
    assert.equal(allowsProposedItem('Vino tinto', { allergens: [], proposeAlcohol: true }), true);
    assert.equal(allowsProposedItem('Vino tinto', { allergens: [], proposeAlcohol: false }), false);
  });

  it('un sustituto con alérgeno no se ofrece en ningún modo', () => {
    const constraints = {
      allergens: ['mani'],
      substitutionMode: 'best_match' as const,
      proposeAlcohol: true,
    };
    assert.equal(allowsSubstitution('Mantequilla de maní', constraints), false);
    assert.equal(allowsSubstitution('Mermelada de damasco', constraints), true);
    assert.equal(allowsSubstitution('Mermelada de damasco', { ...constraints, substitutionMode: 'none' }), false);
    assert.equal(
      allowsSubstitution('Galletas de arroz', { ...constraints, substitutionMode: 'specific', specificReplacements: ['Galletas de arroz'] }),
      true,
    );
    assert.equal(
      allowsSubstitution('Galletas de agua', { ...constraints, substitutionMode: 'specific', specificReplacements: ['Galletas de arroz'] }),
      false,
    );

    const left = normalizeName('Leche Entera Soprole 1L');
    const right = normalizeName('Leche Colun 1L');
    assert.equal(proposeSubstituteReason(left, right, 'Leche Colun 1L', { allergens: ['lacteos'] }), null);
    assert.equal(proposeSubstituteReason(left, right, 'Leche Colun 1L', { allergens: [] }), 'otra marca');
  });

  it('el carro propuesto no incluye el alérgeno ni lo usa para llegar al mínimo', () => {
    const cart = bundleCart([
      item({
        name: 'Leche',
        runOutAt: '2026-10-26',
        quantity: 2,
        offers: [
          { store: 'Jumbo', name: 'Leche Colun 1 L', pricePerUnit: 1000 },
          { store: 'Lider', name: 'Bebida de avena 1 L', pricePerUnit: 1200 },
        ],
      }),
      item({
        name: 'Mantequilla de maní',
        runOutAt: '2026-10-26',
        offers: [{ store: 'Lider', name: 'Mantequilla de maní', pricePerUnit: 3000 }],
      }),
    ], {
      now,
      leadDays: 2,
      bufferDays: 2,
      minimums: { Jumbo: 1000, Lider: 1000 },
      constraints: { allergens: ['lacteos', 'mani'], proposeAlcohol: true, substitutionMode: 'best_match' },
    });
    assert.ok(cart);
    assert.equal(cart!.items.some((line) => /leche|maní|mani/i.test(line.name)), false);
    assert.equal(cart!.items[0].name, 'Bebida de avena 1 L');
  });

  it('el precio más barato no elige un producto con alérgeno', () => {
    const priced = priceQuery('leche colun 1 L', [
      { name: 'Leche Colun 1 L', store: 'Jumbo', price: 1000 },
      { name: 'Leche Colun 1 L', store: 'Lider', price: 900 },
    ], { allergens: ['lacteos'], substitutionMode: 'best_match' });
    assert.equal(priced.cheapest, null);
    assert.equal(priced.lines.every((line) => line.matched === false), true);
  });
});
