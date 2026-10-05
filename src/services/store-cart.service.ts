/**
 * Store Cart Service — Agrega productos al carrito del supermercado
 *
 * AVI actua como capa entre el usuario y el supermercado:
 * 1. Login con credenciales del usuario (almacenadas encriptadas)
 * 2. Busca cada producto por nombre/SKU
 * 3. Agrega al carrito con la cantidad correcta
 * 4. Retorna URL del carrito listo para pagar
 *
 * El usuario solo ve: "Tu carrito en Jumbo esta listo → [Ir a pagar]"
 *
 * Supermercados soportados:
 * - Jumbo (Cencosud BFF API)
 * - Lider Super (Walmart platform)
 * - Unimarc (plataforma propia)
 */

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

interface StoreSession {
  cookies: string;
  token?: string;
  cartId?: string;
}

// ============================================
// JUMBO (Cencosud)
// ============================================

const JUMBO_BFF = 'https://bff.jumbo.cl';
const JUMBO_API_KEY = 'be-reg-groceries-jumbo-catalog-w54byfvkmju5';

async function jumboLogin(email: string, password: string): Promise<StoreSession | null> {
  try {
    const res = await fetch(`${JUMBO_BFF}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': JUMBO_API_KEY,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.jumbo.cl/',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const cookies = res.headers.get('set-cookie') || '';

    return {
      cookies,
      token: data.token || data.accessToken,
      cartId: data.cartId,
    };
  } catch {
    return null;
  }
}

async function jumboSearchProduct(
  query: string,
  session: StoreSession
): Promise<{ sku: string; name: string; price: number } | null> {
  try {
    const res = await fetch(`${JUMBO_BFF}/catalog/plp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': JUMBO_API_KEY,
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.jumbo.cl/',
        ...(session.token ? { 'Authorization': `Bearer ${session.token}` } : {}),
        ...(session.cookies ? { 'Cookie': session.cookies } : {}),
      },
      body: JSON.stringify({ terms: query, page: 1, itemsPerPage: 1 }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (data.products && data.products.length > 0) {
      const p = data.products[0];
      return {
        sku: p.sku || p.productId,
        name: p.displayName || p.name,
        price: p.prices?.offerPrice || p.prices?.normalPrice || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function jumboAddToCart(
  sku: string,
  quantity: number,
  session: StoreSession
): Promise<boolean> {
  try {
    const res = await fetch(`${JUMBO_BFF}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': JUMBO_API_KEY,
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.jumbo.cl/',
        ...(session.token ? { 'Authorization': `Bearer ${session.token}` } : {}),
        ...(session.cookies ? { 'Cookie': session.cookies } : {}),
      },
      body: JSON.stringify({
        items: [{ id: sku, quantity, seller: '1' }],
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function buildJumboCart(
  items: CartItem[],
  email: string,
  password: string
): Promise<CartResult> {
  const apifyToken = process.env.APIFY_API_TOKEN;

  // Try Apify Playwright actor first
  if (apifyToken && password) {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/avi-shopper~avi-cart-jumbo/runs?waitForFinish=120`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apifyToken}` },
          body: JSON.stringify({
            email, password,
            items: items.map((i) => ({ name: i.productName, quantity: i.quantity })),
          }),
        }
      );

      if (runRes.ok) {
        const run = await runRes.json();
        const datasetId = run.data?.defaultDatasetId;
        if (datasetId) {
          const dataRes = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`,
            { headers: { Authorization: `Bearer ${apifyToken}` } }
          );
          const results = await dataRes.json();
          const result = results[0];
          if (result?.success) {
            return {
              success: true, store: 'Jumbo',
              cartUrl: result.cartUrl || 'https://www.jumbo.cl/checkout',
              itemsAdded: result.itemsAdded || 0,
              itemsFailed: result.itemsFailed || [],
              totalEstimated: result.totalEstimated || 0,
            };
          }
        }
      }
    } catch (e: any) {
      console.error('Jumbo Apify cart error:', e.message);
    }
  }

  // Fallback: try old BFF API
  const session = await jumboLogin(email, password);
  if (!session) {
    return {
      success: false, store: 'Jumbo', cartUrl: 'https://www.jumbo.cl/checkout',
      itemsAdded: 0, itemsFailed: items.map((i) => i.productName), totalEstimated: 0,
      error: 'No se pudo iniciar sesion en Jumbo.',
    };
  }

  let added = 0;
  let total = 0;
  const failed: string[] = [];

  for (const item of items) {
    const product = item.sku
      ? { sku: item.sku, name: item.productName, price: item.price || 0 }
      : await jumboSearchProduct(item.productName, session);

    if (!product) { failed.push(item.productName); continue; }

    const success = await jumboAddToCart(product.sku, item.quantity, session);
    if (success) { added++; total += product.price * item.quantity; }
    else { failed.push(item.productName); }

    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    success: added > 0, store: 'Jumbo', cartUrl: 'https://www.jumbo.cl/checkout',
    itemsAdded: added, itemsFailed: failed, totalEstimated: total,
  };
}

// ============================================
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
  return {
    success: false,
    store: 'Unimarc',
    cartUrl: 'https://www.unimarc.cl',
    itemsAdded: 0,
    itemsFailed: items.map((i) => i.productName),
    totalEstimated: 0,
    error: 'Unimarc aun no soporta carrito automatico. Usa los links directos.',
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
