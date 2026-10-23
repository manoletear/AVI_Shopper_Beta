import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HyperbrowserClient, readHyperbrowserConfig } from './hyperbrowser';
import { fillJumboCart } from './jumbo';
import { parseJumboSearchHtml } from './jumbo-search';
import { pickBestMatch, scoreProductName } from './match';
import { jumboHandoffPrompt, storeSearchPrompt } from './prompts';
import { assertSafeCartRequest } from './safety';
import { createJumboGuestSession, jumboCartHandoffUrl, JUMBO_SESSION_STORAGE_KEY } from './session';
import { fillAutomaticCart } from './index';
import { buildUnimarcCartLink } from './unimarc';

const SEARCH_HTML = `
<script type="application/ld+json">
{"@type":"ItemList","itemListElement":[
  {"name":"Leche Colun Entera 1 L","url":"https://www.jumbo.cl/leche-entera-colun-caja-1-l-natural/p"},
  {"name":"Leche Colun Semidescremada Chocolate Receta Original 1 L","url":"https://www.jumbo.cl/leche-chocolate/p"}
]}
</script>
<div data-gtm-impression="{&quot;name&quot;:&quot;Leche Colun Entera 1 L&quot;,&quot;id&quot;:&quot;6697&quot;,&quot;price&quot;:1190,&quot;brand&quot;:&quot;Colun&quot;}"></div>
<div data-gtm-impression="{&quot;name&quot;:&quot;Leche Colun Semidescremada Chocolate Receta Original 1 L&quot;,&quot;id&quot;:&quot;41830&quot;,&quot;price&quot;:1850,&quot;brand&quot;:&quot;Colun&quot;}"></div>
<div data-gtm-impression="{&quot;name&quot;:&quot;Arroz Grado 1 1 kg&quot;,&quot;id&quot;:&quot;12345&quot;,&quot;price&quot;:1490,&quot;brand&quot;:&quot;Tucapel&quot;}"></div>
`;

describe('jumbo search matching', () => {
  it('lee sku, precio y link desde el HTML de Jumbo', () => {
    const products = parseJumboSearchHtml(SEARCH_HTML);
    assert.equal(products.length, 3);
    assert.equal(products[0].sku, '6697');
    assert.equal(products[0].price, 1190);
    assert.equal(products[0].productUrl, 'https://www.jumbo.cl/leche-entera-colun-caja-1-l-natural/p');
  });

  it('elige la leche entera y no la de chocolate', () => {
    const products = parseJumboSearchHtml(SEARCH_HTML);
    const chosen = pickBestMatch('Leche Colun Entera 1L', products);
    assert.equal(chosen?.product.sku, '6697');
    assert.ok(scoreProductName('Leche Colun Entera 1L', products[1].name) < 0.5);
  });
});

describe('sesion de invitado Jumbo', () => {
  it('arma el header como el sitio: guest + uuid sin los 2 primeros caracteres', () => {
    const session = createJumboGuestSession('10614538-52dd-4eda-9f22-a1e7deb05ff3');
    assert.equal(session.guestHeader, 'guest:614538-52dd-4eda-9f22-a1e7deb05ff3');
    const url = new URL(jumboCartHandoffUrl(session.sessionId));
    assert.equal(url.pathname, '/mi-carro');
    assert.equal(url.searchParams.get('avi_session'), session.sessionId);
    assert.equal(JUMBO_SESSION_STORAGE_KEY, 'sessionId');
  });
});

describe('seguridad del carrito', () => {
  it('rechaza llamadas de pago, despacho y transacción', () => {
    for (const path of ['/cart/transaction', '/cart/payment-method', '/cart/checkout', '/cart/shipping-data']) {
      assert.throws(() => assertSafeCartRequest(`https://be-reg-groceries-bff-jumbo.ecomm.cencosud.com${path}`));
    }
    assert.doesNotThrow(() => assertSafeCartRequest('https://be-reg-groceries-bff-jumbo.ecomm.cencosud.com/cart/items'));
  });

  it('el prompt del navegador prohíbe pagar y no pide claves', () => {
    const handoff = jumboHandoffPrompt('10614538-52dd-4eda-9f22-a1e7deb05ff3');
    const search = storeSearchPrompt('tottus', [{ productName: 'Arroz grado 1', quantity: 1 }]);
    for (const prompt of [handoff, search]) {
      assert.match(prompt, /NO pagues/i);
      assert.match(prompt, /NO hagas clic en Pagar/i);
      assert.doesNotMatch(prompt, /password\s*[:=]/i);
    }
  });
});

describe('Unimarc', () => {
  it('arma un link VTEX con varios SKU y no abre el pago', () => {
    const link = buildUnimarcCartLink([
      { sku: '111', quantity: 2 },
      { sku: '222', quantity: 1 },
      { sku: 'no-es-sku', quantity: 1 },
    ]);
    assert.ok(link);
    const url = new URL(link!);
    assert.equal(url.pathname, '/checkout/cart/add');
    assert.deepEqual(url.searchParams.getAll('sku'), ['111', '222']);
    assert.deepEqual(url.searchParams.getAll('qty'), ['2', '1']);
    assert.equal(buildUnimarcCartLink([{ quantity: 1 }]), null);
  });
});

describe('fill de Jumbo con red simulada', () => {
  it('busca, agrega y lee el total sin llamar al pago', async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method || 'GET'} ${url}`);
      if (url.includes('/busqueda')) {
        return new Response(SEARCH_HTML, { status: 200 });
      }
      if (url.endsWith('/cart/items')) {
        assert.equal(init?.method, 'PATCH');
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, 'jumboclj512');
        assert.deepEqual(body.items, [{ skuId: '6697', quantity: 2 }]);
        const headers = new Headers(init?.headers);
        assert.equal(headers.get('x-provider-guest-id'), 'guest:614538-52dd-4eda-9f22-a1e7deb05ff3');
        return new Response('{"id":"cart1"}', { status: 200 });
      }
      if (url.includes('/cart?store=')) {
        return new Response(JSON.stringify({
          id: 'cart1',
          totals: { subTotal: 2720, total: 2380 },
          items: [{
            skuId: '6697',
            name: 'Leche Colun Entera 1 L',
            quantity: 2,
            status: 'available',
            prices: { price: 1190, totalPrice: 2380 },
          }],
        }), { status: 200 });
      }
      return new Response('no', { status: 500 });
    };

    const result = await fillJumboCart(
      [{ productName: 'Leche Colun Entera 1L', quantity: 2 }],
      { fetchImpl, sessionId: '10614538-52dd-4eda-9f22-a1e7deb05ff3' }
    );
    assert.equal(result.itemsAdded, 1);
    assert.equal(result.totalEstimated, 2380);
    assert.equal(result.items[0].matchedName, 'Leche Colun Entera 1 L');
    assert.ok(calls.every((call) => !/transaction|payment|shipping-data|\/checkout/.test(call)));
  });
});

describe('orquestador', () => {
  it('Jumbo queda listo sin clave de Hyperbrowser', async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/busqueda')) return new Response(SEARCH_HTML, { status: 200 });
      if (url.endsWith('/cart/items')) return new Response('{}', { status: 200 });
      return new Response(JSON.stringify({
        totals: { total: 1190 },
        items: [{ skuId: '6697', name: 'Leche Colun Entera 1 L', quantity: 1, status: 'available', prices: { price: 1190, totalPrice: 1190 } }],
      }), { status: 200, headers: init?.headers });
    };
    const result = await fillAutomaticCart(
      'jumbo',
      [{ productName: 'Leche Colun Entera 1 L', quantity: 1 }],
      { fetchImpl, hyperbrowser: null }
    );
    assert.equal(result.status, 'ready');
    assert.equal(result.mode, 'jumbo-bff');
    assert.equal(result.paymentStopped, true);
    assert.equal(result.needsKey, false);
    assert.equal(result.handoff, 'extension');
    assert.match(result.cartUrl, /mi-carro\?avi_session=/);
  });

  it('Lider no se intenta y Tottus pide la clave si no hay navegador', async () => {
    const lider = await fillAutomaticCart('lider', [{ productName: 'Leche' }], { hyperbrowser: null });
    assert.equal(lider.status, 'unsupported');
    const tottus = await fillAutomaticCart('tottus', [{ productName: 'Arroz' }], { hyperbrowser: null });
    assert.equal(tottus.status, 'needs_setup');
    assert.equal(tottus.needsKey, true);
    assert.match(tottus.keyHint || '', /HYPERBROWSER_API_KEY/);
  });

  it('Unimarc con SKU devuelve el link y no pide clave', async () => {
    const result = await fillAutomaticCart(
      'unimarc',
      [{ productName: 'Leche Colun', sku: '555', quantity: 1, price: 990 }],
      { hyperbrowser: null }
    );
    assert.equal(result.mode, 'deep-link');
    assert.equal(result.needsKey, false);
    assert.match(result.cartUrl, /sku=555/);
  });
});

describe('cliente Hyperbrowser', () => {
  it('parte una tarea y deja el navegador abierto, sin pagar', async () => {
    let body = '';
    const fetchImpl: typeof fetch = async (input, init) => {
      body = String(init?.body || '');
      assert.equal(new Headers(init?.headers).get('x-api-key'), 'hb_test');
      assert.match(String(input), /\/api\/task\/hyper-agent$/);
      return new Response(JSON.stringify({ jobId: 'job_123', liveUrl: 'https://app.hyperbrowser.ai/live/abc' }), { status: 200 });
    };
    const client = new HyperbrowserClient({
      apiKey: 'hb_test',
      baseUrl: 'https://api.hyperbrowser.ai',
      llm: 'gpt-4o-mini',
      useStealth: true,
    }, fetchImpl);
    const task = await client.startJumboHandoff('10614538-52dd-4eda-9f22-a1e7deb05ff3');
    assert.equal(task.jobId, 'job_123');
    assert.equal(task.liveUrl, 'https://app.hyperbrowser.ai/live/abc');
    const sent = JSON.parse(body);
    assert.equal(sent.keepBrowserOpen, true);
    assert.equal(sent.maxSteps, 8);
    assert.match(sent.task, /NO pagues/);
    assert.equal(readHyperbrowserConfig({ HYPERBROWSER_API_KEY: 'hb_test' })?.apiKey, 'hb_test');
    assert.equal(readHyperbrowserConfig({}), null);
  });
});
