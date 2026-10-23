/**
 * Store Cart Service — Agrega productos al carrito del supermercado.
 * Jumbo usa el carrito de invitado real (src/services/cart-agent). No paga.
 * Lider, Unimarc y Tottus siguen en el actor de Apify, que nunca llegó a funcionar en producción.
 */
import { fillAutomaticCart } from './cart-agent';

// ============================================
// TIPOS
// ============================================

export interface CartItem {
  productName: string;
  sku?: string;
  quantity: number;
  price?: number;
}

export interface CartResult {
  success: boolean;
  store: string;
  cartUrl: string;
  itemsAdded: number;
  itemsFailed: string[];
  totalEstimated: number;
  error?: string;
}

// ============================================
// JUMBO (Cencosud) — carrito de invitado, sin pago
// ============================================


export async function buildJumboCart(
  items: CartItem[],
  _email: string,
  _password: string
): Promise<CartResult> {
  const filled = await fillAutomaticCart('jumbo', items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    sku: item.sku,
    price: item.price,
  })));
  return {
    success: filled.itemsAdded > 0,
    store: 'Jumbo',
    cartUrl: filled.cartUrl || 'https://www.jumbo.cl/mi-carro',
    itemsAdded: filled.itemsAdded,
    itemsFailed: filled.itemsFailed,
    totalEstimated: filled.totalEstimated,
    error: filled.itemsAdded > 0 ? undefined : filled.message,
  };
}

// LIDER SUPER (Walmart)
// ============================================

export async function buildLiderCart(
  items: CartItem[],
  email: string,
  password: string
): Promise<CartResult> {
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken || !password) {
    return {
      success: false, store: 'Lider', cartUrl: 'https://super.lider.cl',
      itemsAdded: 0, itemsFailed: items.map((i) => i.productName), totalEstimated: 0,
      error: 'Credenciales o token de Apify no configurados.',
    };
  }

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/avi-shopper~avi-cart-lider/runs?waitForFinish=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apifyToken}` },
        body: JSON.stringify({
          email, password,
          items: items.map((i) => ({ name: i.productName, quantity: i.quantity })),
        }),
      }
    );

    if (!runRes.ok) throw new Error('Apify run failed');
    const run = await runRes.json();
    const datasetId = run.data?.defaultDatasetId;
    if (!datasetId) throw new Error('No dataset');

    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`,
      { headers: { Authorization: `Bearer ${apifyToken}` } }
    );
    const results = await dataRes.json();
    const result = results[0];

    if (result?.success) {
      return {
        success: true, store: 'Lider', cartUrl: result.cartUrl || 'https://super.lider.cl/cart',
        itemsAdded: result.itemsAdded || 0,
        itemsFailed: result.itemsFailed || [],
        totalEstimated: result.totalEstimated || 0,
      };
    }
  } catch (e: any) {
    console.error('Lider Apify cart error:', e.message);
  }

  return {
    success: false, store: 'Lider', cartUrl: 'https://super.lider.cl',
    itemsAdded: 0, itemsFailed: items.map((i) => i.productName), totalEstimated: 0,
    error: 'No se pudo armar el carrito en Lider.',
  };
}

// ============================================
// UNIMARC
// ============================================

export async function buildUnimarcCart(
  items: CartItem[],
  email: string,
  password: string
): Promise<CartResult> {
  return buildWithApifyActor('avi-shopper~avi-cart-unimarc', 'Unimarc', 'https://www.unimarc.cl', items, email, password);
}

export async function buildTottusCart(
  items: CartItem[],
  email: string,
  password: string
): Promise<CartResult> {
  return buildWithApifyActor('avi-shopper~avi-cart-tottus', 'Tottus', 'https://www.tottus.cl', items, email, password);
}

async function buildWithApifyActor(
  actorId: string, storeName: string, fallbackUrl: string,
  items: CartItem[], email: string, password: string
): Promise<CartResult> {
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken || !password) {
    return {
      success: false, store: storeName, cartUrl: fallbackUrl,
      itemsAdded: 0, itemsFailed: items.map((i) => i.productName), totalEstimated: 0,
      error: 'Credenciales o token no configurados.',
    };
  }

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?waitForFinish=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apifyToken}` },
        body: JSON.stringify({ email, password, items: items.map((i) => ({ name: i.productName, quantity: i.quantity })) }),
      }
    );
    if (!runRes.ok) throw new Error('Run failed');
    const run = await runRes.json();
    const datasetId = run.data?.defaultDatasetId;
    if (!datasetId) throw new Error('No dataset');

    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`,
      { headers: { Authorization: `Bearer ${apifyToken}` } }
    );
    const results = await dataRes.json();
    const result = results[0];
    if (result?.success) {
      return {
        success: true, store: storeName, cartUrl: result.cartUrl || fallbackUrl,
        itemsAdded: result.itemsAdded || 0, itemsFailed: result.itemsFailed || [],
        totalEstimated: result.totalEstimated || 0,
      };
    }
  } catch (e: any) {
    console.error(`${storeName} Apify cart error:`, e.message);
  }

  return {
    success: false, store: storeName, cartUrl: fallbackUrl,
    itemsAdded: 0, itemsFailed: items.map((i) => i.productName), totalEstimated: 0,
  };
}

// ============================================
// ORQUESTADOR
// ============================================

export async function buildCart(
  storeSlug: string,
  items: CartItem[],
  credentials: { email: string; password: string }
): Promise<CartResult> {
  switch (storeSlug) {
    case 'jumbo':
      return buildJumboCart(items, credentials.email, credentials.password);
    case 'lider':
      return buildLiderCart(items, credentials.email, credentials.password);
    case 'unimarc':
      return buildUnimarcCart(items, credentials.email, credentials.password);
    case 'tottus':
      return buildTottusCart(items, credentials.email, credentials.password);
    default:
      return {
        success: false,
        store: storeSlug,
        cartUrl: '',
        itemsAdded: 0,
        itemsFailed: items.map((i) => i.productName),
        totalEstimated: 0,
        error: `Supermercado "${storeSlug}" no soportado`,
      };
  }
}
