import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import {
  generateHealthReport,
  analyzeProductsHealth,
  predictConsumption,
} from '@/services/health-intelligence.service';

// GET /api/health?mode=report|predictions|alerts
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'report';

    if (mode === 'predictions') {
      const predictions = await predictConsumption(userId);
      return successResponse({ predictions });
    }

    // Para report y alerts, obtener productos de la lista activa
    const latestList = await prisma.shoppingList.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    const products = (latestList?.items || [])
      .filter((item) => item.product)
      .map((item) => ({
        name: item.product!.name,
        sugar: item.product!.sugar ?? undefined,
        fat: item.product!.fat ?? undefined,
        sodium: item.product!.sodium ?? undefined,
        calories: item.product!.calories ?? undefined,
        fiber: item.product!.fiber ?? undefined,
        protein: item.product!.protein ?? undefined,
        isUltraProcessed: item.product!.isUltraProcessed,
      }));

    if (mode === 'alerts') {
      // Obtener alergias del usuario
      const prefs = await prisma.userPreference.findUnique({ where: { userId } });
      let allergies: string[] = [];
      if (prefs?.allergies) {
        try { allergies = JSON.parse(prefs.allergies); } catch { /* */ }
      }
      const alerts = analyzeProductsHealth(products, allergies);
      return successResponse({ alerts });
    }

    // Reporte completo
    const report = await generateHealthReport(userId, products);
    return successResponse(report);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Health API error:', error);
    return errorResponse('Error al generar reporte de salud', 500);
  }
}
