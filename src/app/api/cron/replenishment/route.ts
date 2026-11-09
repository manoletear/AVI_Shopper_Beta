import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/responses';
import { isCronAuthorized } from '@/services/notifications/auth';
import { applyPendingPurchases, refreshProfiles } from '@/services/consumption/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    console.warn('[cron/replenishment] 401: CRON_SECRET no configurado o no coincide');
    return errorResponse('No autorizado', 401);
  }
  try {
    let totalApplied = 0;
    let waiting = 0;
    for (let pass = 0; pass < 10; pass++) {
      const result = await applyPendingPurchases();
      totalApplied += result.applied;
      waiting = result.waiting;
      if (result.applied === 0) break;
    }
    let profilesRefreshed = 0;
    if (totalApplied > 0) {
      const result = await refreshProfiles();
      profilesRefreshed = result.opened + result.dismissed;
    }
    return successResponse({ applied: totalApplied, waiting, profilesRefreshed });
  } catch (error) {
    console.error('Replenishment cron error:', error);
    return errorResponse('No pude revisar el consumo', 500);
  }
}
