import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { decryptSession, encryptSession, parseStoreKey } from '../../src/lib/stores/crypto';
import { compareCarts, connectStore, fillCart, StoreToolError, type FillRecord, type StoreRepo } from '../../src/lib/stores/fill-cart';
import { isForbiddenCheckoutUrl, looksLikeBlockerTitle, parseClp, sameProduct } from '../../src/lib/stores/guards';
import { callStoreWorker, StoreWorkerError } from '../../src/lib/stores/remote';
import { runWorkerJob, workerAuthorized } from '../../src/lib/stores/worker';
import type { StoreAdapter, StoreCart, StoreProduct } from '../../src/lib/stores/types';

const KEY = randomBytes(32).toString('base64');
const CTX = { familyId: 'fam-a', storeSlug: 'jumbo' };

describe('cifrado de sesión', () => {
  it('ida y vuelta, IV aleatorio de 12 bytes', () => {
    const a = encryptSession('{"sid":"x"}', CTX, KEY);
    const b = encryptSession('{"sid":"x"}', CTX, KEY);
    assert.notEqual(a, b);
    assert.equal(Buffer.from(a.split('.')[1], 'base64url').length, 12);
    assert.equal(decryptSession(a, CTX, KEY), '{"sid":"x"}');
  });

  it('falla con tag alterado, otra clave u otra familia', () => {
    const payload = encryptSession('secreto', CTX, KEY);
    const parts = payload.split('.');
    const tag = Buffer.from(parts[2], 'base64url');
    tag[0] ^= 1;
    assert.throws(() => decryptSession([parts[0], parts[1], tag.toString('base64url'), parts[3]].join('.'), CTX, KEY));
    assert.throws(() => decryptSession(payload, CTX, randomBytes(32).toString('base64')));
    assert.throws(() => decryptSession(payload, { familyId: 'fam-b', storeSlug: 'jumbo' }, KEY));
  });

  it('exige clave de 32 bytes reales', () => {
    assert.throws(() => parseStoreKey(undefined), /AVI_STORE_KEY/);
    assert.throws(() => parseStoreKey('x'.repeat(40)), /AVI_STORE_KEY/);
    assert.equal(parseStoreKey(randomBytes(32).toString('hex')).length, 32);
    assert.throws(() => decryptSession('v0.a.b.c', CTX, KEY), /formato/);
  });
});

describe('guardas', () => {
  it('bloquea rutas de pago y checkout final', () => {
    assert.ok(isForbiddenCheckoutUrl('https://www.jumbo.cl/api/checkout/pub/orderForm/abc/transaction'));
    assert.ok(isForbiddenCheckoutUrl('https://www.jumbo.cl/checkout/#/payment'));
    assert.ok(isForbiddenCheckoutUrl('https://www.jumbo.cl/checkout/orderPlaced/?og=1'));
    assert.ok(!isForbiddenCheckoutUrl('https://www.jumbo.cl/checkout/#/cart'));
    assert.ok(!isForbiddenCheckoutUrl('https://www.jumbo.cl/leche-colun-1-l/p'));
  });

  it('detecta páginas de verificación', () => {
    assert.ok(looksLikeBlockerTitle('Just a moment...'));
    assert.ok(!looksLikeBlockerTitle('Leche Colun | Jumbo'));
  });

  it('precios CLP y mismo producto', () => {
    assert.equal(parseClp('$2.690'), 2690);
    assert.equal(parseClp(''), 0);
    assert.ok(sameProduct('Leche semidescremada Colun', 'Leche Colun Semi-descremada 1 L'.replace('Semi-', 'Semi')));
    assert.ok(sameProduct('Mantequilla Soprole', 'Mantequilla con sal Soprole 250 g'));
    assert.ok(!sameProduct('Jamón serrano', 'Jamón de pavo'));
  });
});

const cart = (items: StoreCart['items']): StoreCart => {
  const total = items.reduce((s, i) => s + i.totalPrice, 0);
  return { items, subtotal: total, total };
};

describe('compareCarts', () => {
  it('detecta faltantes, cantidades y extras', () => {
    const result = compareCarts(
      [
        { name: 'Leche Colun', quantity: 4, payable: 4760 },
        { name: 'Mantequilla Soprole', quantity: 1, payable: 2790 },
      ],
      cart([
        { sku: '1', name: 'Leche Colun 1 L', quantity: 2, unitPrice: 1190, totalPrice: 2380 },
        { sku: '9', name: 'Chocolate', quantity: 1, unitPrice: 1000, totalPrice: 1000 },
      ]),
    );
    assert.equal(result.matches, false);
    assert.deepEqual(result.missing.map((m) => [m.name, m.inStore]), [['Leche Colun', 2], ['Mantequilla Soprole', 0]]);
    assert.deepEqual(result.extraInStore, [{ name: 'Chocolate', quantity: 1 }]);
    assert.equal(result.diffClp, 3380 - 7550);
  });
});

function product(name: string, url: string, available = true): StoreProduct {
  return { sku: null, name, price: 1000, available, url };
}

class FakeAdapter implements StoreAdapter {
  readonly slug = 'jumbo' as const;
  storeItems: StoreCart['items'] = [];
  closed = false;
  constructor(
    private catalog: StoreProduct[],
    private session: 'ok' | 'needs_user_action' | 'expired' = 'ok',
    private outOfStock = new Set<string>(),
  ) {}
  async login() {
    return this.session === 'ok' ? { status: 'ok' as const, sessionCookies: '[]' } : { status: this.session };
  }
  async restoreSession() {
    return this.session === 'ok' ? { status: 'ok' as const, sessionCookies: '[{"n":1}]' } : { status: this.session };
  }
  async searchProduct(input: { query?: string }) {
    const q = (input.query || '').toLowerCase().split(' ')[0];
    return this.catalog.filter((p) => p.name.toLowerCase().includes(q));
  }
  async addToCart(items: Array<{ name: string; quantity: number; productUrl?: string }>) {
    const result = { added: [] as Array<{ name: string; quantity: number }>, failed: [] as Array<{ name: string; reason: 'out_of_stock' }> };
    for (const item of items) {
      if (this.outOfStock.has(item.productUrl || '')) {
        result.failed.push({ name: item.name, reason: 'out_of_stock' });
        continue;
      }
      const p = this.catalog.find((c) => c.url === item.productUrl)!;
      this.storeItems.push({ sku: null, name: p.name, quantity: item.quantity, unitPrice: p.price, totalPrice: p.price * item.quantity });
      result.added.push({ name: item.name, quantity: item.quantity });
    }
    return result;
  }
  async getCart() {
    return cart(this.storeItems);
  }
  async getDeliveryWindows() {
    return [];
  }
  async clearCart() {}
  async close() {
    this.closed = true;
  }
}

function makeRepo(opts: { status?: string; family?: string; connection?: 'active' | 'needs_user_action' | null } = {}) {
  const fills: FillRecord[] = [];
  const saved: Array<{ status: string; encryptedSession?: string }> = [];
  let filled = false;
  const encrypted = encryptSession('[{"sid":"x"}]', CTX, KEY);
  const repo: StoreRepo = {
    async getCart(familyId, cartId) {
      return familyId === (opts.family ?? 'fam-a') && cartId === 'cart-1'
        ? { id: 'cart-1', storeSlug: 'jumbo', status: opts.status ?? 'approved' }
        : null;
    },
    async getApprovedItems() {
      return [
        { id: 'i1', name: 'Leche Colun', quantity: 4, payable: 4000, canonicalProductId: 'canon-leche' },
        { id: 'i2', name: 'Mantequilla Soprole', quantity: 1, payable: 1000, canonicalProductId: null },
        { id: 'i3', name: 'Jamón serrano', quantity: 2, payable: 2000, canonicalProductId: null },
      ];
    },
    async findListingUrl(_slug, canonicalId) {
      return canonicalId === 'canon-leche' ? 'https://www.jumbo.cl/leche/p' : null;
    },
    async getConnection() {
      return opts.connection === null ? null : { encryptedSession: encrypted, status: opts.connection ?? 'active' };
    },
    async saveConnection(_f, _s, data) {
      saved.push(data);
    },
    async saveFill(record) {
      fills.push(record);
      return `fill-${fills.length}`;
    },
    async markCartFilled() {
      filled = true;
    },
  };
  return { repo, fills, saved, isFilled: () => filled };
}

const CATALOG = [
  product('Leche Colun Semidescremada 1 L', 'https://www.jumbo.cl/leche/p'),
  product('Mantequilla con sal Soprole 250 g', 'https://www.jumbo.cl/mantequilla/p'),
  product('Jamón de pavo San Jorge', 'https://www.jumbo.cl/pavo/p'),
];

describe('fillCart', () => {
  it('agrega aprobados, propone sustituto pendiente sin agregarlo y no marca lleno si falta algo', async () => {
    const { repo, fills, saved, isFilled } = makeRepo();
    const adapter = new FakeAdapter(CATALOG);
    const result = await fillCart('fam-a', 'cart-1', { repo, createAdapter: async () => adapter, storeKey: KEY });
    assert.equal(result.status, 'partial');
    assert.equal(result.itemsAdded, 2);
    assert.deepEqual(adapter.storeItems.map((i) => i.name), ['Leche Colun Semidescremada 1 L', 'Mantequilla con sal Soprole 250 g']);
    assert.equal(result.substitutes.length, 1);
    assert.equal(result.substitutes[0].name, 'Jamón serrano');
    assert.equal(result.substitutes[0].candidate?.name, 'Jamón de pavo San Jorge');
    assert.equal(result.substitutes[0].approval, 'pending');
    assert.equal(isFilled(), false);
    assert.equal(fills.length, 1);
    assert.ok(adapter.closed);
    // cookies renovadas se guardan cifradas, nunca en claro
    assert.ok(saved[0].encryptedSession?.startsWith('v1.'));
    assert.ok(!saved[0].encryptedSession?.includes('"n":1'));
  });

  it('sin stock en la ficha fija: propone sustituto y no lo agrega', async () => {
    const { repo } = makeRepo();
    const adapter = new FakeAdapter(CATALOG, 'ok', new Set(['https://www.jumbo.cl/leche/p']));
    const result = await fillCart('fam-a', 'cart-1', { repo, createAdapter: async () => adapter, storeKey: KEY });
    const leche = result.substitutes.find((s) => s.itemId === 'i1');
    assert.equal(leche?.reason, 'out_of_stock');
    assert.ok(!adapter.storeItems.some((i) => i.name.startsWith('Leche')));
  });

  it('rechaza carros no aprobados y de otra familia', async () => {
    const deps = { repo: makeRepo({ status: 'proposed' }).repo, createAdapter: async () => new FakeAdapter(CATALOG), storeKey: KEY };
    await assert.rejects(fillCart('fam-a', 'cart-1', deps), /aprobado/);
    await assert.rejects(fillCart('fam-b', 'cart-1', deps), StoreToolError);
  });

  it('captcha o 2FA: needs_user_action, no agrega nada', async () => {
    const { repo, saved } = makeRepo();
    const adapter = new FakeAdapter(CATALOG, 'needs_user_action');
    const result = await fillCart('fam-a', 'cart-1', { repo, createAdapter: async () => adapter, storeKey: KEY });
    assert.equal(result.status, 'needs_user_action');
    assert.equal(adapter.storeItems.length, 0);
    assert.equal(saved[0].status, 'needs_user_action');
  });

  it('sin conexión guardada: error claro', async () => {
    const deps = { repo: makeRepo({ connection: null }).repo, createAdapter: async () => new FakeAdapter(CATALOG), storeKey: KEY };
    await assert.rejects(fillCart('fam-a', 'cart-1', deps), /conectado/);
  });

  it('connectStore guarda solo cookies cifradas', async () => {
    const { repo, saved } = makeRepo();
    const out = await connectStore('fam-a', 'jumbo', { email: 'a@b.cl', password: 'pw-secreta' }, {
      repo,
      createAdapter: async () => new FakeAdapter(CATALOG),
      storeKey: KEY,
    });
    assert.equal(out.status, 'active');
    assert.ok(!JSON.stringify(saved).includes('pw-secreta'));
  });
});

describe('worker y cliente remoto', () => {
  const SECRET = 's'.repeat(40);
  it('autoriza solo con el secreto exacto', () => {
    assert.ok(workerAuthorized(`Bearer ${SECRET}`, SECRET));
    assert.ok(!workerAuthorized(`Bearer ${SECRET}x`, SECRET));
    assert.ok(!workerAuthorized(`Bearer short`, 'short'));
    assert.ok(!workerAuthorized(null, SECRET));
  });

  it('valida el trabajo', async () => {
    const deps = { repo: makeRepo().repo, createAdapter: async () => new FakeAdapter(CATALOG), storeKey: KEY };
    assert.equal((await runWorkerJob({ op: 'checkout', familyId: 'fam-a' }, deps)).status, 400);
    assert.equal((await runWorkerJob({ op: 'fill_cart', familyId: 'fam-b', cartId: 'cart-1' }, deps)).status, 422);
  });

  it('sin configuración no llama a nadie', async () => {
    await assert.rejects(callStoreWorker({ op: 'fill_cart', familyId: 'f', cartId: 'c' }, {}), StoreWorkerError);
  });

  it('manda el secreto y pasa el error 422', async () => {
    let auth = '';
    const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
      auth = String((init?.headers as Record<string, string>).authorization);
      return new Response(JSON.stringify({ error: 'No encontré ese carro en esta familia' }), { status: 422 });
    }) as typeof fetch;
    await assert.rejects(
      callStoreWorker({ op: 'fill_cart', familyId: 'f', cartId: 'c' }, { url: 'https://w.example', secret: SECRET }, fakeFetch),
      /No encontré/,
    );
    assert.equal(auth, `Bearer ${SECRET}`);
  });
});
