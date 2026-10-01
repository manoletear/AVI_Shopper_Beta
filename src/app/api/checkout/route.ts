import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';
import { buildCart } from '@/services/store-cart.service';

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

    // Obtener credenciales del supermercado del usuario
    const storeAccount = await prisma.storeAccount.findFirst({
      where: {
        userId,
        store: { slug: storeSlug },
      },
      include: { store: true },
    });

    if (!storeAccount) {
      return errorResponse(
        `No tienes cuenta vinculada en ${storeSlug}. Ve a /configuracion/cuentas para vincularla.`,
        400,
        'NO_STORE_ACCOUNT'
      );
    }

    // Armar el carrito
    const result = await buildCart(storeSlug, cartItems, {
      email: storeAccount.accountEmail,
      password: '', // Las credenciales de login del super se manejan aparte
    });

    if (result.success) {
      return successResponse({
        cartUrl: result.cartUrl,
        itemsAdded: result.itemsAdded,
        itemsFailed: result.itemsFailed,
        totalEstimated: result.totalEstimated,
        store: result.store,
        message: `Carrito armado en ${result.store} con ${result.itemsAdded} productos. Haz click para pagar.`,
      });
    } else {
      // Fallback: generar deep links
      const searchUrls: Record<string, (q: string) => string> = {
        jumbo: (q) => `https://www.jumbo.cl/buscar?ft=${encodeURIComponent(q)}`,
        lider: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`,
        unimarc: (q) => `https://www.unimarc.cl/buscar?q=${encodeURIComponent(q)}`,
        'santa-isabel': (q) => `https://www.santaisabel.cl/buscar?ft=${encodeURIComponent(q)}`,
      };
      const urlFn = searchUrls[storeSlug] || searchUrls.jumbo;

      const links = cartItems.map((item: any) => ({
        product: item.productName,
        url: urlFn(item.productName),
        quantity: item.quantity,
      }));

      return successResponse({
        cartUrl: null,
        fallback: true,
        links,
        store: storeSlug,
        message: `No se pudo armar el carrito automaticamente. Usa estos links para agregar cada producto manualmente.`,
        error: result.error,
      });
    }
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Checkout error:', error);
    return errorResponse('Error al armar el carrito', 500);
  }
}
