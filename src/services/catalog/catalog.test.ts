import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { priceQuery } from '../offer-pricing';
import { productKey } from '../consumption/predict';
import { createFuzzyMatcher, grokFuzzyMatcher, heuristicFuzzyMatcher } from './ai';
import { measureMatchAccuracy } from './accuracy';
import { LABELED_PRODUCTS } from './examples';
import { matchListing } from './match';
import { shouldShowWithQuery } from './compare';
import { normalizeName } from './normalize';
import { applyReview } from './review';
import { substituteReason } from './substitutes';

describe('catálogo canónico', () => {
  it('mide precisión y recall en los nombres chilenos', async () => {
    const report = await measureMatchAccuracy();
    assert.equal(report.precision, 1);
    assert.equal(report.recall, 1);
    assert.equal(report.accuracy, 1);
    assert.equal(report.falsePositives, 0);
    assert.equal(report.falseNegatives, 0);
    assert.ok(report.truePositives >= 14);
  });

  it('no confunde sustitutos ni cortes parecidos', () => {
    const soprole = normalizeName('Leche Entera Soprole 1L');
    const soproleJumbo = normalizeName('Leche Soprole Entera 1 L');
    const colun = normalizeName('Leche Colun 1L');
    const six = normalizeName('Leche Soprole Entera 6x1L');
    const descremada = normalizeName('Leche Soprole Descremada 1L');
    const granel = normalizeName('Lomo vetado Cat-V granel');
    const vacio = normalizeName('Lomo vetado Cat-V al vacío 500g');
    const entrana = normalizeName('Entraña');
    const entranita = normalizeName('Entrañita');
    const integral = normalizeName('Pan molde Ideal integral');
    const blanco = normalizeName('Pan molde Ideal blanco');

    assert.equal(soprole.identity, soproleJumbo.identity);
    assert.equal(soprole.sizeAmount, 1000);
    assert.equal(soprole.sizeUnit, 'ml');
    assert.equal(six.packCount, 6);
    assert.equal(granel.soldByWeight, true);
    assert.equal(vacio.soldByWeight, false);
    assert.equal(vacio.sizeAmount, 500);
    assert.notEqual(entrana.identity, entranita.identity);

    assert.equal(substituteReason(soprole, colun), 'otra marca');
    assert.equal(substituteReason(soprole, six), 'otro formato');
    assert.equal(substituteReason(soprole, descremada), null);
    assert.equal(substituteReason(granel, vacio), 'otro formato');
    assert.equal(substituteReason(entrana, entranita), null);
    assert.equal(substituteReason(integral, blanco), null);
  });

  it('agrupa la reposición por marca y variante, no por el orden ni el tamaño', () => {
    assert.equal(productKey('Leche Colun Entera 1 L'), productKey('leche colun entera'));
    assert.equal(productKey('Leche Entera Soprole 1L'), productKey('Leche Soprole Entera'));
    assert.notEqual(productKey('Leche Colun Entera'), productKey('Leche Soprole Entera'));
    assert.notEqual(productKey('Entraña'), productKey('Entrañita'));
    assert.equal(productKey('Queso 500 g'), productKey('Queso 1 kg'));
  });

  it('el más barato es el mismo producto, no el sustituto más barato', () => {
    const milk = priceQuery('Leche Entera Soprole 1L', [
      { name: 'Leche Soprole Entera 1 L', store: 'Jumbo', price: 1190 },
      { name: 'Leche Entera Soprole 1L', store: 'Lider', price: 1090 },
      { name: 'Leche Colun 1L', store: 'Unimarc', price: 890 },
      { name: 'Leche Soprole Entera 6x1 L', store: 'Tottus', price: 4990 },
    ]);
    assert.equal(milk.cheapest?.store, 'Lider');
    assert.equal(milk.cheapest?.payable, 1090);
    assert.equal(milk.lines.find((line) => line.store === 'Unimarc')?.catalogRelation, 'substitute');
    assert.equal(milk.lines.find((line) => line.store === 'Unimarc')?.catalogReason, 'otra marca');
    assert.equal(milk.lines.find((line) => line.store === 'Tottus')?.catalogRelation, 'substitute');
    assert.match(milk.lines.find((line) => line.store === 'Tottus')?.pricePerUnitLabel || '', /\/ L/);

    const sixLiters = priceQuery('Leche Entera Soprole 6 L', [
      { name: 'Leche Entera Soprole 1L', store: 'Lider', price: 1090 },
      { name: 'Leche Soprole Entera 6x1 L', store: 'Tottus', price: 4990 },
    ]);
    assert.equal(sixLiters.cheapest?.store, 'Lider');
    assert.equal(sixLiters.cheapest?.payable, 6540);
    assert.equal(sixLiters.lines.find((line) => line.store === 'Tottus')?.comparable, false);

    const meat = priceQuery('Entraña', [
      { name: 'Entrañita', store: 'Tottus', price: 20000, soldByWeight: true },
      { name: 'Entraña', store: 'Lider', price: 39990, soldByWeight: true },
    ]);
    assert.equal(meat.cheapest?.store, 'Lider');
    assert.equal(meat.lines.find((line) => line.name === 'Entrañita')?.catalogRelation, 'other');
    assert.equal(shouldShowWithQuery('Entraña', 'Entrañita'), true);
    assert.equal(shouldShowWithQuery('Entraña', 'Leche Colun 1L'), false);
  });

  it('Grok confirma sobre 0,85; sin clave la ficha queda en revisión y no sale a la red', async () => {
    const original = global.fetch;
    const originalKey = process.env.XAI_API_KEY;
    let calls = 0;
    try {
      delete process.env.XAI_API_KEY;
      global.fetch = async () => {
        calls += 1;
        throw new Error('no debía llamar a la red');
      };
      assert.equal(createFuzzyMatcher().match, heuristicFuzzyMatcher.match);
      const local = await matchListing({ rawName: 'Leche entera Soproel 1L' }, LABELED_PRODUCTS, createFuzzyMatcher());
      assert.equal(local.status, 'pending');
      assert.equal(calls, 0);

      process.env.XAI_API_KEY = 'test-key';
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"candidateId":"soprole-1","confidence":0.91,"reason":"Es la Soprole entera, con la marca mal escrita"}' } }],
        }),
      } as Response);
      const confirmed = await matchListing({ rawName: 'Leche entera Soproel 1L' }, LABELED_PRODUCTS, grokFuzzyMatcher);
      assert.equal(confirmed.status, 'matched');
      assert.equal(confirmed.method, 'ai');
      assert.equal(confirmed.canonicalId, 'soprole-1');
      assert.equal(confirmed.confidence, 0.91);

      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"candidateId":"soprole-1","confidence":0.62,"reason":"Se parece, pero no estoy seguro"}' } }],
        }),
      } as Response);
      const pending = await matchListing({ rawName: 'Leche entera Soproel 1L' }, LABELED_PRODUCTS, grokFuzzyMatcher);
      assert.equal(pending.status, 'pending');
      assert.equal(pending.canonicalId, 'soprole-1');
    } finally {
      global.fetch = original;
      if (originalKey == null) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = originalKey;
    }
  });

  it('una persona confirma, rechaza o fusiona la ficha', () => {
    const review = { id: 'r1', listingId: 'l1', suggestedId: 'soprole-1', status: 'pending' };
    const confirmed = applyReview('confirm', review);
    assert.equal(confirmed.listing.canonicalId, 'soprole-1');
    assert.equal(confirmed.review.status, 'confirmed');

    const rejected = applyReview('reject', review, null, 'Es otra leche');
    assert.equal(rejected.listing.matchStatus, 'rejected');
    assert.equal(rejected.review.resolverNote, 'Es otra leche');

    const merged = applyReview('merge', review, 'soprole-6');
    assert.equal(merged.listing.canonicalId, 'soprole-6');
    assert.equal(merged.review.status, 'merged');
    assert.equal(merged.reassignFrom, null);
    assert.throws(() => applyReview('confirm', { ...review, status: 'confirmed' }));
  });
});
