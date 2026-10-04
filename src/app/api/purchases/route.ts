import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { familyWhere } from '@/lib/family';

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
