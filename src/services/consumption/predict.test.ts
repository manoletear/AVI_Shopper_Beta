import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFeedback,
  applyPurchase,
  baseAmountFromCatalog,
  coldStartRate,
  emptyProfile,
  eventMultiplier,
  forecastProducts,
  householdEquivalents,
  householdGroupKey,
  productKey,
  purchaseAmount,
  robustEwma,
  seasonFactor,
  shrinkRate,
} from './predict';

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

describe('consumo del hogar', () => {
  const now = new Date('2026-10-15T15:00:00.000Z');

  it('con una sola compra usa el prior y lo dice', () => {
    const [only] = forecastProducts([
      { productName: 'Arroz grado 1 1 kg', quantity: 1, purchasedAt: daysBefore(now, 10), storeName: 'Jumbo' },
    ], now);
    assert.ok(only);
    assert.equal(only.confidence, 'baja');
    assert.equal(only.alert, false);
    assert.match(only.message, /una sola compra/i);
    assert.match(only.message, /prior/i);
    assert.equal(only.history.length, 1);
    assert.ok((only.daysLeft || 0) > 6);
  });

  it('la leche de todas las semanas se encoge hacia el prior', () => {
    const events = [33, 26, 19, 12, 5].map((days) => ({
      productName: 'Leche Colun Entera 1 L',
      quantity: 6,
      unit: 'L',
      purchasedAt: daysBefore(now, days),
      storeName: 'Jumbo',
    }));
    const [milk] = forecastProducts(events, now);
    assert.ok(milk);
    const rate = shrinkRate(0.25, 6 / 7, 4);
    const stock = 6 - rate * 5;
    assert.equal(milk.daysLeft, Math.round(stock / rate));
    assert.equal(milk.daysLeft, 4);
    assert.equal(milk.alert, false);
    assert.equal(milk.confidence, 'alta');
    assert.equal(milk.weeklyAmount, Math.round(rate * 7 * 10) / 10);
    assert.match(milk.message, /se acaba en ~4 días/);
    assert.match(milk.message, /6 L/);
    assert.match(milk.message, /10\/oct/);
    assert.equal(milk.history.length, 5);
    assert.ok(milk.runOutEarly && milk.predictedDate && milk.runOutLate);
    assert.ok(milk.runOutEarly <= milk.predictedDate);
    assert.ok(milk.predictedDate <= milk.runOutLate);
  });

  it('un salto largo no dispara el ritmo', () => {
    const events = [50, 43, 3].map((days) => ({
      productName: 'Azúcar 1 kg',
      quantity: 1,
      unit: 'kg',
      purchasedAt: daysBefore(now, days),
    }));
    const [sugar] = forecastProducts(events, now);
    assert.ok(sugar);
    assert.ok((sugar.weeklyAmount || 0) > 0.3);
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
    assert.ok(cheese);
    const firstBuy = cheese.history[0];
    const secondBuy = cheese.history[1];
    const thirdBuy = cheese.history[2];
    assert.ok(firstBuy);
    assert.ok(secondBuy);
    assert.ok(thirdBuy);
    assert.equal(cheese.unit, 'kg');
    assert.equal(firstBuy.amount, 0.5);
    assert.equal(secondBuy.amount, 1);
    assert.equal(thirdBuy.amount, 0.5);
    assert.equal(cheese.purchases, 3);
  });

  it('recorta un ritmo absurdo con la mediana y el MAD', () => {
    const calm = robustEwma([1, 1, 1, 1]);
    const spiked = robustEwma([1, 1, 1, 100]);
    assert.ok(Math.abs(calm.mu - 1) < 0.001);
    assert.ok(spiked.mu < 3);
    assert.ok(spiked.mu > 0.5);
  });

  it('escala el prior por el hogar y deja fuera a la mascota', () => {
    const equivalents = householdEquivalents([
      { role: 'adult', type: 'person' },
      { role: 'child', type: 'person' },
      { role: 'elder', type: 'person' },
      { role: 'adult', type: 'pet' },
    ]);
    assert.ok(Math.abs(equivalents - 2.4) < 1e-9);
    assert.ok(Math.abs(coldStartRate(0.25, equivalents) - 0.6) < 1e-9);
    const [milk] = forecastProducts([
      { productName: 'Leche 1 L', quantity: 1, unit: 'L', purchasedAt: daysBefore(now, 1) },
    ], now, { equivalents });
    const alone = forecastProducts([
      { productName: 'Leche 1 L', quantity: 1, unit: 'L', purchasedAt: daysBefore(now, 1) },
    ], now, { equivalents: 1 })[0];
    assert.ok(milk);
    assert.ok(alone);
    assert.ok((milk.ratePerDay || 0) > (alone.ratePerDay || 0));
  });

  it('el catálogo pasa el pack a litros', () => {
    const six = baseAmountFromCatalog(1, null, 'Leche Soprole Entera 6x1 L', {
      sizeAmount: 1000,
      sizeUnit: 'ml',
      packCount: 6,
      soldByWeight: false,
    });
    const weight = baseAmountFromCatalog(1.5, 'kg', 'Lomo vetado granel', { soldByWeight: true });
    assert.deepEqual(six, { baseAmount: 6, baseUnit: 'L' });
    assert.deepEqual(weight, { baseAmount: 1.5, baseUnit: 'kg' });
    assert.equal(householdGroupKey('Leche Colun Entera 1 L'), householdGroupKey('Leche Soprole Entera 1 L'));
  });

  it('una compra masiva del mismo día no abre otro intervalo', () => {
    let profile = emptyProfile('L');
    profile = applyPurchase(profile, { at: '2026-10-01T12:00:00.000Z', amount: 2 });
    profile = applyPurchase(profile, { at: '2026-10-01T18:00:00.000Z', amount: 2 });
    assert.equal(profile.nIntervals, 0);
    assert.equal(profile.lastAmount, 4);
    assert.equal(profile.nPurchases, 2);
  });

  it('el feedback corrige stock, ritmo y pausa', () => {
    let profile = emptyProfile('L');
    profile = applyPurchase(profile, { at: daysBefore(now, 14), amount: 6 });
    profile = applyPurchase(profile, { at: daysBefore(now, 7), amount: 6 });
    const before = profile.ratePerDay;
    const stocked = applyFeedback(profile, { kind: 'ya_tengo', stockReported: 4 }, now);
    assert.equal(stocked.estStock, 4);
    const sooner = applyFeedback(profile, { kind: 'se_acabo_antes', at: daysBefore(now, 4) }, now);
    assert.ok(sooner.ratePerDay > before);
    assert.equal(sooner.estStock, 0);
    const paused = applyFeedback(profile, { kind: 'ya_tengo' }, now);
    assert.ok(paused.ratePerDay < before);
    const frozen = applyFeedback(profile, { kind: 'no_compro_mas' }, now);
    assert.equal(frozen.frozen, true);
    const ignored = applyPurchase(frozen, { at: now, amount: 6 });
    assert.equal(ignored.nPurchases, frozen.nPurchases);
  });

  it('las vacaciones frenan el consumo y la estacionalidad espera 12 meses', () => {
    assert.equal(seasonFactor([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0), 1);
    const year = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3];
    assert.ok(seasonFactor(year, 11) > 1);
    const factor = eventMultiplier([
      { multiplier: 0, startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-31T00:00:00.000Z' },
    ], now);
    assert.equal(factor, 0);
    const [milk] = forecastProducts([
      { productName: 'Leche 1 L', quantity: 6, unit: 'L', purchasedAt: daysBefore(now, 14) },
      { productName: 'Leche 1 L', quantity: 6, unit: 'L', purchasedAt: daysBefore(now, 7) },
    ], now, { events: [{ multiplier: 0, startsAt: daysBefore(now, 1), endsAt: daysBefore(now, -10) }] });
    assert.ok(milk);
    assert.equal(milk.alert, false);
    assert.match(milk.message, /pausa/);
  });
});
