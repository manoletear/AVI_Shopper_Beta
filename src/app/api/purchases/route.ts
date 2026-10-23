import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';
import { familyWhere } from '@/lib/family';
import { recordMultiplePurchases } from '@/services/purchase-learning.service';

const purchaseSchema = z.object({
  items: z.array(z.object({
    productName: z.string().min(1).max(160),
    quantity: z.number().int().positive().max(99).optional(),
    unit: z.string().max(16).optional(),
    price: z.number().int().nonnegative().max(5_000_000).optional(),
    storeSlug: z.string().max(40).optional(),
    storeName: z.string().max(80).optional(),
    purchasedAt: z.string().max(40).optional(),
    source: z.enum(['manual', 'avi-cart', 'list', 'agent']).optional(),
  })).min(1).max(30),
});

export async function GET() {
  try {
    const userId = await requireAuth();
    const where = await familyWhere(userId);

    const purchases = await prisma.purchaseHistory.findMany({
      where,
      orderBy: { purchasedAt: 'desc' },
      take: 200,
    });

    return successResponse(purchases);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Purchases error:', error);
    return errorResponse('Error al obtener historial', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const parsed = purchaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse('Revisa los productos de la compra', 400, 'INVALID_PURCHASE');
    }
    const count = await recordMultiplePurchases(userId, parsed.data.items.map((item) => ({
      ...item,
      source: item.source || 'manual',
    })));
    return createdResponse({ count });
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Record purchase error:', error);
    return errorResponse('No pude guardar la compra', 500);
  }
}
