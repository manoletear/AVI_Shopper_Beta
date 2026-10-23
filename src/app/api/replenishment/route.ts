import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import {
  generateReplenishmentAlerts,
  generateMonthlyPlan,
  analyzeConsumptionHistory,
  autoAddToShoppingList,
} from '@/services/replenishment.service';

// GET /api/replenishment?mode=alerts|plan|history
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'alerts';

    if (mode === 'history') {
      const history = await analyzeConsumptionHistory(userId);
      return successResponse({ consumptions: history });
    }

    if (mode === 'plan') {
      const plan = await generateMonthlyPlan(userId);
      return successResponse(plan);
    }

    // Default: alerts
    const daysAhead = parseInt(searchParams.get('days') || '30');
    const alerts = await generateReplenishmentAlerts(userId, daysAhead);
    return successResponse({ alerts, total: alerts.length });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Replenishment error:', error);
    return errorResponse('Error al generar predicciones', 500);
  }
}

// POST /api/replenishment — Auto-agregar productos urgentes a lista
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { listId, urgency, productName } = body;

    const result = await autoAddToShoppingList(
      userId,
      listId,
      urgency || 'add_now',
      typeof productName === 'string' ? productName : undefined
    );

    return successResponse({
      listId: result.listId,
      addedItems: result.addedItems,
      count: result.addedItems.length,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Auto-add error:', error);
    return errorResponse('Error al agregar productos', 500);
  }
}
