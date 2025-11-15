import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { getUserAnalytics, getSpendingTrends } from '@/services/analytics.service';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const type = searchParams.get('type') || 'summary'; // summary, trends

    if (type === 'trends') {
      const trends = await getSpendingTrends(userId, days);
      return successResponse({ trends });
    }

    // Default: return summary analytics
    const analytics = await getUserAnalytics(userId, days);
    return successResponse(analytics);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get analytics error:', error);
    return errorResponse('Error al obtener analytics', 500);
  }
}
