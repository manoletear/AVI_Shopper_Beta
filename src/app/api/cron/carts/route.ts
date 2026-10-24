import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/responses';
import { isCronAuthorized } from '@/services/notifications/auth';
import { proposeWeeklyCarts, refreshProfiles } from '@/services/consumption/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return errorResponse('No autorizado', 401);
  }
  try {
    await refreshProfiles();
    const result = await proposeWeeklyCarts();
    return successResponse(result);
  } catch (error) {
    console.error('Cart cron error:', error);
    return errorResponse('No pude armar el carro', 500);
  }
}
