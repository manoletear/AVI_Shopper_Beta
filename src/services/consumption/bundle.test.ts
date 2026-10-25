import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundleCart, BundleItem, linePayable } from './bundle';

const now = new Date('2026-10-24T12:00:00.000Z');

function item(partial: Partial<BundleItem> & Pick<BundleItem, 'name' | 'runOutAt' | 'offers'>): BundleItem {
  return {
    groupKey: partial.groupKey || partial.name,
    quantity: partial.quantity ?? 1,
    unit: partial.unit || 'un',
    ...partial,
  };
}

describe('carro agrupado', () => {
  it('junta lo que se acaba en la misma ventana en la tienda más barata', () => {
    const cart = bundleCart([
      item({
        name: 'Leche',
        runOutAt: '2026-10-26',
        quantity: 6,
        unit: 'L',
        offers: [
          { store: 'Jumbo', name: 'Leche 1 L', pricePerUnit: 1190 },
          { store: 'Lider', name: 'Leche 1 L', pricePerUnit: 1090 },
        ],
      }),
      item({
        name: 'Pan',
        runOutAt: '2026-10-30',
        quantity: 2,
        unit: 'kg',
        offers: [
          { store: 'Jumbo', name: 'Pan', pricePerUnit: 4000 },
          { store: 'Lider', name: 'Pan', pricePerUnit: 3500 },
        ],
      }),
      item({
        name: 'Arroz',
        runOutAt: '2026-12-01',
        quantity: 1,
        unit: 'kg',
        offers: [
          { store: 'Jumbo', name: 'Arroz', pricePerUnit: 2000 },
          { store: 'Lider', name: 'Arroz', pricePerUnit: 1800 },
        ],
      }),
    ], {
      now,
      leadDays: 2,
      bufferDays: 2,
      minimums: { Jumbo: 10000, Lider: 10000 },
    });
    assert.ok(cart);
    assert.equal(cart!.status, 'proposed');
    assert.equal(cart!.store, 'Lider');
    assert.equal(cart!.items.length, 2);
    assert.equal(cart!.items.some((line) => line.name === 'Arroz'), false);
    assert.match(cart!.note, /no paga/i);
    assert.equal('paymentUrl' in cart!, false);
  });

  it('adelanta el siguiente producto si no llega al mínimo', () => {
    const cart = bundleCart([
      item({
        name: 'Leche',
        runOutAt: '2026-10-26',
        offers: [{ store: 'Lider', name: 'Leche', pricePerUnit: 5000 }],
      }),
      item({
        name: 'Arroz',
        runOutAt: '2026-12-01',
        offers: [{ store: 'Lider', name: 'Arroz', pricePerUnit: 6000 }],
      }),
    ], { now, leadDays: 2, bufferDays: 2, minimums: { Lider: 10000 }, delivery: { Lider: 990 } });
    assert.ok(cart);
    assert.equal(cart!.meetsMinimum, true);
    assert.equal(cart!.subtotal, 11000);
    assert.equal(cart!.items.filter((line) => line.pulledForward).length, 1);
  });

  it('cambia de tienda cuando una no llega al mínimo', () => {
    const cart = bundleCart([
      item({
        name: 'Leche',
        runOutAt: '2026-10-26',
        quantity: 2,
        offers: [
          { store: 'Jumbo', name: 'Leche', pricePerUnit: 4000 },
          { store: 'Lider', name: 'Leche', pricePerUnit: 6000 },
        ],
      }),
    ], { now, leadDays: 2, bufferDays: 2, minimums: { Jumbo: 20000, Lider: 10000 } });
    assert.equal(cart!.store, 'Lider');
    assert.equal(cart!.meetsMinimum, true);
  });

  it('respeta el mínimo de 1,5 kg en la carne de Tottus', () => {
    const priced = linePayable(1, { store: 'Tottus', name: 'Lomo vetado', pricePerUnit: 35605, minPurchase: 1.5, step: 0.5 });
    assert.equal(priced.bought, 1.5);
    assert.equal(priced.payable, 53408);
    const cart = bundleCart([
      item({
        name: 'Lomo',
        runOutAt: '2026-10-25',
        quantity: 1,
        unit: 'kg',
        offers: [{ store: 'Tottus', name: 'Lomo vetado', pricePerUnit: 35605, minPurchase: 1.5, step: 0.5 }],
      }),
    ], { now, leadDays: 2, bufferDays: 2, minimums: { Tottus: 10000 } });
    const line = cart!.items[0];
    assert.ok(line);
    assert.equal(line.payable, 53408);
    assert.equal(cart!.status, 'proposed');
  });
});
