import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { getUserNutritionSummary } from '@/services/nutrition.service';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week'; // week, month

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    if (period === 'week') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    }

    const summary = await getUserNutritionSummary(userId, startDate, endDate);

    return successResponse(summary);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get nutrition summary error:', error);
    return errorResponse('Error al obtener datos nutricionales', 500);
  }
}
