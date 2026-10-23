import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';
import { familyWhere } from '@/lib/family';
import { fillAutomaticCart } from '@/services/cart-agent';
import { CartRequestItem } from '@/services/cart-agent/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  storeSlug: z.string().min(2).max(40),
  listId: z.string().min(1).max(80).optional(),
  items: z.array(z.object({
    productName: z.string().min(1).max(160),
    quantity: z.number().int().positive().max(24).optional(),
    sku: z.string().min(1).max(40).optional(),
    price: z.number().int().nonnegative().max(5_000_000).optional(),
  })).max(12).optional(),
});

async function itemsFromList(userId: string, listId: string): Promise<CartRequestItem[] | null> {
  const family = await familyWhere(userId);
  const list = await prisma.shoppingList.findFirst({
    where: { id: listId, ...family },
    include: { items: { where: { checked: false } } },
  });
  if (!list) return null;
  return list.items.map((item) => ({
    productName: item.name,
    quantity: item.quantity,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse('Revisa el supermercado y los productos.', 400, 'INVALID_CART');
    }

    let items = parsed.data.items as CartRequestItem[] | undefined;
    if ((!items || items.length === 0) && parsed.data.listId) {
      const fromList = await itemsFromList(userId, parsed.data.listId);
      if (!fromList) return errorResponse('Lista no encontrada', 404);
      items = fromList;
    }
    if (!items || items.length === 0) {
      return errorResponse('No hay productos para agregar al carrito', 400);
    }

    const result = await fillAutomaticCart(parsed.data.storeSlug, items);
    return successResponse(result);
  } catch (error: unknown) {
    const known = error as { statusCode?: number; message?: string; code?: string };
    if (known.statusCode) {
      return errorResponse(known.message || 'No autorizado', known.statusCode, known.code);
    }
    console.error('Checkout auto error:', error);
    return errorResponse('No pude armar el carrito', 500);
  }
}
