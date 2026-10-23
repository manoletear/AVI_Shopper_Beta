import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { priceBaskets, priceQuery } from './offer-pricing';

describe('precio efectivo', () => {
  it('Tottus no gana por el precio del kilo si obliga a llevar 1,5 kg', () => {
    const priced = priceQuery('lomo vetado', [
      { name: 'Lomo vetado', store: 'Tottus', price: 35605, soldByWeight: true },
      { name: 'Lomo vetado', store: 'Lider', price: 39990, soldByWeight: true },
      { name: 'Lomo vetado bandeja 1 kg', store: 'Jumbo', price: 44990 },
    ]);

    const tottus = priced.lines.find((line) => line.store === 'Tottus');
    assert.equal(tottus?.boughtAmount, 1.5);
    assert.equal(tottus?.payable, 53408);
    assert.match(tottus?.note || '', /1,5 kg/);
    assert.equal(priced.cheapest?.store, 'Lider');
    assert.equal(priced.cheapest?.payable, 39990);
    assert.equal(priced.requestLabel, '1 kg');
  });

  it('un kilo y tres cuartos al mismo precio del kilo se acerca a lo cobrado en el carrito', () => {
    const priced = priceQuery('lomo vetado 1,75 kg', [
      { name: 'Lomo vetado', store: 'Tottus', price: 35605, soldByWeight: true, minAmount: 1.5, stepAmount: 0.25 },
    ]);
    assert.equal(priced.lines[0].boughtAmount, 1.75);
    assert.equal(priced.lines[0].payable, 62309);
  });

  it('arma los litros pedidos aunque el formato sea de 1 L', () => {
    const priced = priceQuery('leche colun 6 L', [
      { name: 'Leche Colun Entera 1 L', store: 'Jumbo', price: 1190 },
      { name: 'Leche Colun Entera 1 L', store: 'Lider', price: 1390 },
    ]);
    assert.equal(priced.cheapest?.store, 'Jumbo');
    assert.equal(priced.cheapest?.payable, 7140);
    assert.equal(priced.cheapest?.boughtAmount, 6);
  });

  it('no elige una oferta sin stock ni una que no alcanza', () => {
    const priced = priceQuery('arroz 2 kg', [
      { name: 'Arroz 1 kg', store: 'Jumbo', price: 1000, inStock: false },
      { name: 'Arroz 1 kg', store: 'Lider', price: 1200, stock: 1 },
      { name: 'Arroz 1 kg', store: 'Unimarc', price: 1500, stock: 3 },
    ]);
    assert.equal(priced.lines.find((line) => line.store === 'Jumbo')?.matched, false);
    assert.equal(priced.lines.find((line) => line.store === 'Lider')?.matched, false);
    assert.equal(priced.cheapest?.store, 'Unimarc');
    assert.equal(priced.cheapest?.payable, 3000);
  });

  it('el despacho puede cambiar la tienda más barata del carro', () => {
    const lomo = priceQuery('lomo vetado', [
      { name: 'Lomo vetado', store: 'Tottus', price: 30000, soldByWeight: true },
      { name: 'Lomo vetado', store: 'Lider', price: 42000, soldByWeight: true },
    ]);
    const arroz = priceQuery('arroz 1 kg', [
      { name: 'Arroz 1 kg', store: 'Tottus', price: 2000 },
      { name: 'Arroz 1 kg', store: 'Lider', price: 1800 },
    ]);
    const baskets = priceBaskets(
      [
        { query: 'lomo vetado', lines: lomo.lines },
        { query: 'arroz 1 kg', lines: arroz.lines },
      ],
      { Tottus: 2990, Lider: 990 }
    );
    const complete = baskets.filter((basket) => basket.complete);
    const winner = complete.reduce((best, basket) => (basket.total < best.total ? basket : best));
    assert.equal(winner.store, 'Lider');
    assert.ok(complete.find((basket) => basket.store === 'Tottus')!.total > winner.total);
  });
});
