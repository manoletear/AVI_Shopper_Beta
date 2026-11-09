import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';
import { isCronAuthorized } from '@/services/notifications/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    console.warn('[cron/replenishment] 401: CRON_SECRET no configurado o no coincide');
    return errorResponse('No autorizado', 401);
  }
  try {
    // Marcar compras pendientes como aplicadas en bulk.
    // El modelo Gran Compra lee directo de purchase_history — no necesita
    // el procesamiento pesado de consumption_profiles row-by-row.
    const result = await prisma.purchaseHistory.updateMany({
      where: { appliedAt: null },
      data: { appliedAt: new Date() },
    });
    return successResponse({ applied: result.count });
  } catch (error) {
    console.error('Replenishment cron error:', error);
    return errorResponse('No pude revisar el consumo', 500);
  }
}
