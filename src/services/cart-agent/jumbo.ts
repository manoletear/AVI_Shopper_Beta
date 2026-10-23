import { pickBestMatch } from './match';
import { parseJumboSearchHtml } from './jumbo-search';
import { assertSafeCartRequest } from './safety';
import { createJumboGuestSession, jumboCartHandoffUrl } from './session';
import {
  CartLineResult,
  CartRequestItem,
  JUMBO_CART_API,
  JUMBO_DEFAULT_SELLER,
  JUMBO_PUBLIC_CART_KEY,
  JUMBO_SEARCH_PAGE,
  JumboProduct,
} from './types';

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface JumboCartFill {
  sessionId: string;
  guestHeader: string;
  cartUrl: string;
  items: CartLineResult[];
  itemsAdded: number;
  itemsFailed: string[];
  totalEstimated: number;
  cartId?: string;
}

interface JumboCartItem {
  skuId?: string;
  name?: string;
  quantity?: number;
  status?: string;
  prices?: { price?: number; totalPrice?: number };
}

interface JumboCartPayload {
  id?: string;
  itemsQuantity?: number;
  totals?: { total?: number; subTotal?: number } | null;
  items?: JumboCartItem[];
}

function cartApiBase(): string {
  return (process.env.JUMBO_CART_API_URL || JUMBO_CART_API).replace(/\/$/, '');
}

function sellerId(): string {
  return process.env.JUMBO_SELLER_ID || JUMBO_DEFAULT_SELLER;
}

function cartKey(): string {
  return process.env.JUMBO_CART_API_KEY || JUMBO_PUBLIC_CART_KEY;
}

async function jumboFetch(
  fetchImpl: FetchLike,
  url: string,
  guestHeader: string,
  init?: RequestInit
): Promise<Response> {
  assertSafeCartRequest(url);
  const headers = new Headers(init?.headers);
  headers.set('apikey', cartKey());
  headers.set('content-type', 'application/json');
  headers.set('x-client-platform', 'web');
  headers.set('x-client-version', '1.3.2');
  headers.set('origin', 'https://www.jumbo.cl');
  headers.set('referer', 'https://www.jumbo.cl/');
  headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  headers.set('x-provider-guest-id', guestHeader);
  return fetchImpl(url, { ...init, headers });
}

export async function searchJumboProducts(
  query: string,
  fetchImpl: FetchLike = fetch
): Promise<JumboProduct[]> {
  const url = `${JUMBO_SEARCH_PAGE}?ft=${encodeURIComponent(query)}`;
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html',
    },
  });
  if (!response.ok) {
    throw new Error(`Jumbo no respondió la búsqueda (${response.status})`);
  }
  const html = await response.text();
  return parseJumboSearchHtml(html);
}

function lineFromCart(item: CartRequestItem, product: JumboProduct, cartItem?: JumboCartItem): CartLineResult {
  const quantity = Math.max(1, item.quantity || 1);
  const unit = cartItem?.prices?.price ?? product.price;
  const lineTotal = cartItem?.prices?.totalPrice ?? (unit != null ? unit * quantity : undefined);
  return {
    query: item.productName,
    quantity: cartItem?.quantity || quantity,
    added: true,
    matchedName: cartItem?.name || product.name,
    sku: product.sku,
    price: unit,
    lineTotal,
    productUrl: product.productUrl,
  };
}

export async function fillJumboCart(
  items: CartRequestItem[],
  options: { fetchImpl?: FetchLike; sessionId?: string } = {}
): Promise<JumboCartFill> {
  const fetchImpl = options.fetchImpl || fetch;
  const { sessionId, guestHeader } = createJumboGuestSession(options.sessionId);
  const seller = sellerId();
  const lines: CartLineResult[] = [];
  const toAdd: Array<{ skuId: string; quantity: number; product: JumboProduct; query: CartRequestItem }> = [];

  for (const item of items) {
    const quantity = Math.max(1, Math.min(24, item.quantity || 1));
    try {
      const products = item.sku
        ? [{ name: item.productName, sku: item.sku, price: item.price }]
        : await searchJumboProducts(item.productName, fetchImpl);
      const chosen = item.sku
        ? products[0]
        : pickBestMatch(item.productName, products)?.product;
      if (!chosen?.sku) {
        lines.push({
          query: item.productName,
          quantity,
          added: false,
          reason: 'No encontré un producto parecido en Jumbo.',
        });
        continue;
      }
      toAdd.push({ skuId: chosen.sku, quantity, product: chosen, query: { ...item, quantity } });
    } catch (error) {
      lines.push({
        query: item.productName,
        quantity,
        added: false,
        reason: error instanceof Error ? error.message : 'Falló la búsqueda en Jumbo.',
      });
    }
  }

  let cartId: string | undefined;
  let totalEstimated = 0;

  if (toAdd.length > 0) {
    const patchUrl = `${cartApiBase()}/cart/items`;
    const patch = await jumboFetch(fetchImpl, patchUrl, guestHeader, {
      method: 'PATCH',
      body: JSON.stringify({
        items: toAdd.map((entry) => ({ skuId: entry.skuId, quantity: entry.quantity })),
        store: seller,
      }),
    });
    if (!patch.ok) {
      const detail = await patch.text();
      throw new Error(`Jumbo rechazó el carrito (${patch.status}): ${detail.slice(0, 180)}`);
    }

    const cartResponse = await jumboFetch(
      fetchImpl,
      `${cartApiBase()}/cart?store=${encodeURIComponent(seller)}&simulationTotals=true`,
      guestHeader
    );
    if (!cartResponse.ok) {
      throw new Error(`No pude leer el carrito de Jumbo (${cartResponse.status})`);
    }
    const cart = (await cartResponse.json()) as JumboCartPayload;
    cartId = cart.id;
    if (typeof cart.totals?.total === 'number') {
      totalEstimated = Math.round(cart.totals.total);
    }

    const bySku = new Map((cart.items || []).map((entry) => [String(entry.skuId), entry]));
    for (const entry of toAdd) {
      const cartItem = bySku.get(entry.skuId);
      const added = Boolean(cartItem) && cartItem?.status !== 'without_stock';
      if (!added) {
        lines.push({
          query: entry.query.productName,
          quantity: entry.quantity,
          added: false,
          matchedName: entry.product.name,
          sku: entry.skuId,
          productUrl: entry.product.productUrl,
          reason: 'Jumbo no dejó el producto en el carrito.',
        });
        continue;
      }
      const line = lineFromCart(entry.query, entry.product, cartItem);
      lines.push(line);
      if (totalEstimated === 0 && line.lineTotal) totalEstimated += line.lineTotal;
    }
  }

  const itemsAdded = lines.filter((line) => line.added).length;
  return {
    sessionId,
    guestHeader,
    cartUrl: jumboCartHandoffUrl(sessionId),
    items: lines,
    itemsAdded,
    itemsFailed: lines.filter((line) => !line.added).map((line) => line.query),
    totalEstimated,
    cartId,
  };
}
