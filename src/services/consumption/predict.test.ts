import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { forecastProducts, productKey, purchaseAmount } from './predict';

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

describe('consumo del hogar', () => {
  const now = new Date('2026-10-15T15:00:00.000Z');

  it('no avisa con una sola compra y lo dice', () => {
    const [only] = forecastProducts([
      { productName: 'Arroz grado 1 1 kg', quantity: 1, purchasedAt: daysBefore(now, 10), storeName: 'Jumbo' },
    ], now);
    assert.equal(only.confidence, 'insuficiente');
    assert.equal(only.alert, false);
    assert.match(only.message, /una compra/i);
    assert.equal(only.history.length, 1);
  });

  it('avisa la leche con la cantidad y la fecha de la última compra', () => {
    const events = [33, 26, 19, 12, 5].map((days) => ({
      productName: 'Leche Colun Entera 1 L',
      quantity: 6,
      unit: 'L',
      purchasedAt: daysBefore(now, days),
      storeName: 'Jumbo',
    }));
    const [milk] = forecastProducts(events, now);
    assert.equal(milk.daysLeft, 2);
    assert.equal(milk.alert, true);
    assert.equal(milk.confidence, 'alta');
    assert.equal(milk.weeklyAmount, 6);
    assert.match(milk.message, /se acaba en ~2 días/);
    assert.match(milk.message, /6 L/);
    assert.match(milk.message, /10\/oct/);
    assert.equal(milk.history.length, 5);
  });

  it('un salto largo no borra el ritmo habitual', () => {
    const events = [50, 43, 3].map((days) => ({
      productName: 'Azúcar 1 kg',
      quantity: 1,
      unit: 'kg',
      purchasedAt: daysBefore(now, days),
    }));
    const [sugar] = forecastProducts(events, now);
    assert.ok((sugar.weeklyAmount || 0) > 0.4);
    assert.ok((sugar.weeklyAmount || 0) < 1.5);
  });

  it('normaliza packs de 1 L y compras anotadas en litros', () => {
    const packs = purchaseAmount({ productName: 'Leche Colun 1 L', quantity: 6, purchasedAt: now });
    const liters = purchaseAmount({ productName: 'Leche Colun', quantity: 6, unit: 'L', purchasedAt: now });
    assert.deepEqual(packs, { amount: 6, unit: 'L' });
    assert.deepEqual(liters, { amount: 6, unit: 'L' });
    assert.equal(productKey('Leche Colun Entera 1 L'), productKey('leche colun entera'));
  });

  it('junta gramos y kilos del mismo producto', () => {
    const events = [
      { productName: 'Queso 500 g', quantity: 1, purchasedAt: daysBefore(now, 20) },
      { productName: 'Queso 1 kg', quantity: 1, purchasedAt: daysBefore(now, 10) },
      { productName: 'Queso', quantity: 500, unit: 'g', purchasedAt: daysBefore(now, 2) },
    ];
    const [cheese] = forecastProducts(events, now);
    assert.equal(cheese.unit, 'kg');
    assert.equal(cheese.history[0].amount, 0.5);
    assert.equal(cheese.history[1].amount, 1);
    assert.equal(cheese.history[2].amount, 0.5);
    assert.equal(cheese.purchases, 3);
  });
});
