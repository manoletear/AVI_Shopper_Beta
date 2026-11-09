import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/responses';
import { isCronAuthorized } from '@/services/notifications/auth';
import { applyPendingPurchases, refreshProfiles } from '@/services/consumption/sync';
import { syncReplenishmentAlerts } from '@/services/replenishment.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    console.warn('[cron/replenishment] 401: CRON_SECRET no configurado o no coincide');
    return errorResponse('No autorizado', 401);
  }
  try {
    // 1. Procesar compras pendientes (onboarding o incrementales)
    let totalApplied = 0;
    for (let pass = 0; pass < 10; pass++) {
      const { applied } = await applyPendingPurchases();
      totalApplied += applied;
      if (applied === 0) break;
    }
    // 2. Refrescar proyecciones de stock
    if (totalApplied > 0) await refreshProfiles();
    // 3. Sincronizar alertas de reposición
    const alerts = await syncReplenishmentAlerts();
    return successResponse({ applied: totalApplied, ...alerts });
  } catch (error) {
    console.error('Replenishment cron error:', error);
    return errorResponse('No pude revisar el consumo', 500);
  }
}
