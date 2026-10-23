import { HyperbrowserClient, readHyperbrowserConfig } from './hyperbrowser';
import { FetchLike, fillJumboCart } from './jumbo';
import { HYPERBROWSER_KEY_HINT, AutomaticCartResult, CartRequestItem } from './types';
import { buildUnimarcCartLink, unimarcSearchUrl } from './unimarc';

const STORE_NAMES: Record<string, string> = {
  jumbo: 'Jumbo',
  unimarc: 'Unimarc',
  tottus: 'Tottus',
  lider: 'Lider',
};

function assistedLinks(storeSlug: string, items: CartRequestItem[]) {
  const search: Record<string, (query: string) => string> = {
    jumbo: (query) => `https://www.jumbo.cl/busqueda?ft=${encodeURIComponent(query)}`,
    unimarc: unimarcSearchUrl,
    tottus: (query) => `https://www.tottus.cl/tottus-cl/search?Ntt=${encodeURIComponent(query)}`,
    lider: (query) => `https://super.lider.cl/search?q=${encodeURIComponent(query)}`,
  };
  const urlFor = search[storeSlug] || search.jumbo;
  return items.map((item) => ({
    query: item.productName,
    quantity: item.quantity || 1,
    added: false,
    productUrl: item.sku && storeSlug === 'unimarc' ? buildUnimarcCartLink([item]) || urlFor(item.productName) : urlFor(item.productName),
    sku: item.sku,
    reason: 'Quedó para agregarlo a mano.',
  }));
}

function baseResult(storeSlug: string, partial: Partial<AutomaticCartResult> & Pick<AutomaticCartResult, 'status' | 'mode' | 'message'>): AutomaticCartResult {
  return {
    store: STORE_NAMES[storeSlug] || storeSlug,
    storeSlug,
    itemsAdded: 0,
    itemsFailed: [],
    items: [],
    totalEstimated: 0,
    cartUrl: '',
    liveUrl: null,
    jobId: null,
    handoff: 'none',
    paymentStopped: true,
    needsKey: false,
    ...partial,
  };
}

export async function fillAutomaticCart(
  storeSlug: string,
  items: CartRequestItem[],
  options: { hyperbrowser?: HyperbrowserClient | null; fetchImpl?: FetchLike } = {}
): Promise<AutomaticCartResult> {
  const slug = storeSlug.toLowerCase();
  if (!items.length) {
    return baseResult(slug, {
      status: 'failed',
      mode: 'assisted',
      message: 'La lista no tiene productos.',
    });
  }

  if (slug === 'lider') {
    return baseResult(slug, {
      status: 'unsupported',
      mode: 'unsupported',
      message: 'Lider queda para después: el sitio bloquea los navegadores automáticos. Por ahora agrégalos uno por uno.',
      cartUrl: 'https://super.lider.cl/cart',
      items: assistedLinks(slug, items),
      itemsFailed: items.map((item) => item.productName),
      handoff: 'none',
    });
  }

  if (slug === 'jumbo') {
    const filled = await fillJumboCart(items, { fetchImpl: options.fetchImpl });
    const hyperbrowser = options.hyperbrowser === undefined
      ? clientFromEnv()
      : options.hyperbrowser;
    let liveUrl: string | null = null;
    let jobId: string | null = null;
    let handoff: AutomaticCartResult['handoff'] = filled.itemsAdded > 0 ? 'extension' : 'none';
    if (filled.itemsAdded > 0 && hyperbrowser) {
      try {
        const task = await hyperbrowser.startJumboHandoff(filled.sessionId);
        liveUrl = task.liveUrl;
        jobId = task.jobId;
        handoff = 'cloud';
      } catch (error) {
        console.error('Hyperbrowser handoff:', error instanceof Error ? error.message : error);
      }
    }
    const failed = filled.itemsAdded === 0;
    return baseResult(slug, {
      status: failed ? 'failed' : jobId && !liveUrl ? 'running' : 'ready',
      mode: 'jumbo-bff',
      message: failed
        ? 'No pude armar el carrito en Jumbo. Prueba el modo uno por uno.'
        : `Listo. ${filled.itemsAdded} producto${filled.itemsAdded === 1 ? '' : 's'} en el carrito de Jumbo. Total $${filled.totalEstimated.toLocaleString('es-CL')}. Ábrelo para pagar tú mismo. AVI no paga.`,
      items: filled.items,
      itemsAdded: filled.itemsAdded,
      itemsFailed: filled.itemsFailed,
      totalEstimated: filled.totalEstimated,
      cartUrl: filled.cartUrl,
      liveUrl,
      jobId,
      handoff,
      needsKey: false,
    });
  }

  if (slug === 'unimarc') {
    const link = buildUnimarcCartLink(items);
    if (link) {
      const priced = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
      return baseResult(slug, {
        status: 'ready',
        mode: 'deep-link',
        message: 'Unimarc abre este link en tu navegador y agrega los productos a tu carrito. Tú pagas después. AVI no cobra.',
        cartUrl: link,
        handoff: 'user-browser',
        itemsAdded: items.length,
        totalEstimated: priced,
        items: items.map((item) => ({
          query: item.productName,
          quantity: item.quantity || 1,
          added: true,
          sku: item.sku,
          price: item.price,
          lineTotal: item.price ? item.price * (item.quantity || 1) : undefined,
          productUrl: link,
        })),
      });
    }
  }

  if (slug === 'unimarc' || slug === 'tottus') {
    const hyperbrowser = options.hyperbrowser === undefined ? clientFromEnv() : options.hyperbrowser;
    if (!hyperbrowser) {
      const cartUrl = slug === 'unimarc'
        ? 'https://www.unimarc.cl/checkout'
        : 'https://www.tottus.cl/tottus-cl/checkout';
      return baseResult(slug, {
        status: 'needs_setup',
        mode: 'assisted',
        needsKey: true,
        keyHint: HYPERBROWSER_KEY_HINT,
        message: slug === 'unimarc'
          ? 'Sin SKU de Unimarc no puedo armar el link directo. Falta HYPERBROWSER_API_KEY para que un navegador en la nube lo haga, o agrégalos a mano.'
          : 'Tottus se arma con el navegador en la nube. Falta HYPERBROWSER_API_KEY (plan gratis en hyperbrowser.ai). Mientras tanto, ábrelos uno por uno.',
        cartUrl,
        items: assistedLinks(slug, items),
        itemsFailed: items.map((item) => item.productName),
        handoff: 'none',
      });
    }
    const task = await hyperbrowser.startStoreFill(slug, items);
    return baseResult(slug, {
      status: 'running',
      mode: 'hyperbrowser',
      message: `AVI está armando el carrito en ${STORE_NAMES[slug]}. No va a pagar. Revisa el avance en unos segundos.`,
      jobId: task.jobId,
      liveUrl: task.liveUrl,
      cartUrl: task.liveUrl || '',
      handoff: 'cloud',
      items: items.map((item) => ({
        query: item.productName,
        quantity: item.quantity || 1,
        added: false,
        reason: 'En curso',
      })),
    });
  }

  return baseResult(slug, {
    status: 'failed',
    mode: 'unsupported',
    message: `El supermercado "${storeSlug}" no está en la compra automática.`,
    itemsFailed: items.map((item) => item.productName),
  });
}

function clientFromEnv(): HyperbrowserClient | null {
  const config = readHyperbrowserConfig();
  return config ? new HyperbrowserClient(config) : null;
}

export function hyperbrowserFromEnv(): HyperbrowserClient | null {
  return clientFromEnv();
}
