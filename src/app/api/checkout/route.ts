import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';
import { buildCart } from '@/services/store-cart.service';
import { decrypt } from '@/lib/encryption';
import { recordMultiplePurchases } from '@/services/purchase-learning.service';

const STORE_SEARCH_URLS: Record<string, (q: string) => string> = {
  jumbo: (q) => `https://www.jumbo.cl/search?ft=${encodeURIComponent(q)}`,
  lider: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`,
  unimarc: (q) => `https://www.unimarc.cl/search?q=${encodeURIComponent(q)}`,
  'santa-isabel': (q) => `https://www.santaisabel.cl/buscar?ft=${encodeURIComponent(q)}`,
  tottus: (q) => `https://www.google.com/search?q=${encodeURIComponent(q + ' site:tottus.cl')}`,
};

const STORE_CART_URLS: Record<string, string> = {
  jumbo: 'https://www.jumbo.cl/checkout',
  lider: 'https://super.lider.cl/cart',
  unimarc: 'https://www.unimarc.cl/checkout',
  'santa-isabel': 'https://www.santaisabel.cl/checkout',
  tottus: 'https://www.tottus.cl/checkout',
};

// POST /api/checkout — Armar carrito en el supermercado
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { storeSlug, items, listId } = body;

    if (!storeSlug) {
      return errorResponse('storeSlug requerido', 400);
    }

    // Obtener items de la lista si no se pasan directamente
    let cartItems = items;
    if (!cartItems && listId) {
      const list = await prisma.shoppingList.findFirst({
        where: { id: listId, userId },
        include: { items: { where: { checked: false } } },
      });
      if (!list) return errorResponse('Lista no encontrada', 404);
      cartItems = list.items.map((i) => ({
        productName: i.name,
        quantity: i.quantity,
      }));
    }

    if (!cartItems || cartItems.length === 0) {
      return errorResponse('No hay productos para agregar al carrito', 400);
    }

    // Intentar carrito automatico si tiene cuenta vinculada
    const storeAccount = await prisma.storeAccount.findFirst({
      where: { userId, store: { slug: storeSlug } },
      include: { store: true },
    });

    if (storeAccount && storeAccount.accountPassword) {
      let password = '';
      try {
        password = decrypt(storeAccount.accountPassword);
      } catch {}

      const result = await buildCart(storeSlug, cartItems, {
        email: storeAccount.accountEmail,
        password,
      });

      if (result.success) {
        recordMultiplePurchases(userId, cartItems.map((item: any) => ({
          productName: item.productName,
          storeSlug,
          storeName: result.store,
          price: item.price || undefined,
          quantity: item.quantity || 1,
          source: 'checkout',
        }))).catch(() => {});

        return successResponse({
          mode: 'auto',
          cartUrl: result.cartUrl,
          itemsAdded: result.itemsAdded,
          itemsFailed: result.itemsFailed,
          totalEstimated: result.totalEstimated,
          store: result.store,
          message: `Carrito armado en ${result.store} con ${result.itemsAdded} productos. Click para pagar.`,
        });
      }
    }

    // Modo visitante: generar links directos por producto
    const urlFn = STORE_SEARCH_URLS[storeSlug];
    if (!urlFn) {
      return errorResponse(`Supermercado "${storeSlug}" no soportado`, 400);
    }

    const links = cartItems.map((item: any) => ({
      product: item.productName,
      quantity: item.quantity || 1,
      url: item.productUrl || urlFn(item.productName),
    }));

    recordMultiplePurchases(userId, cartItems.map((item: any) => ({
      productName: item.productName,
      storeSlug,
      storeName: storeSlug,
      price: item.price || undefined,
      quantity: item.quantity || 1,
      source: 'checkout-guest',
    }))).catch(() => {});

    return successResponse({
      mode: 'guest',
      cartUrl: STORE_CART_URLS[storeSlug] || null,
      links,
      store: storeSlug,
      hasAccount: !!storeAccount,
      message: storeAccount
        ? `No se pudo armar el carrito automaticamente. Abre cada link, agrega al carrito y paga.`
        : `Abre cada producto en el super, agrégalo al carrito y completa la compra como visitante.`,
      tip: !storeAccount
        ? 'Vincula tu cuenta en /configuracion/cuentas para que AVI arme el carrito automaticamente la proxima vez.'
        : null,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Checkout error:', error);
    return errorResponse('Error al armar el carrito', 500);
  }
}
