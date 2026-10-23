import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/responses';
import { isCronAuthorized } from '@/services/notifications/auth';
import { syncReplenishmentAlerts } from '@/services/replenishment.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return errorResponse('No autorizado', 401);
  }
  try {
    const result = await syncReplenishmentAlerts();
    return successResponse(result);
  } catch (error) {
    console.error('Replenishment cron error:', error);
    return errorResponse('No pude revisar el consumo', 500);
  }
}
