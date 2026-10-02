import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { lookupNutrition, enrichProductsNutrition, getNutritionBadge } from '@/services/openfoodfacts.service';

// GET /api/nutrition/lookup?q=leche+colun
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return errorResponse('Parámetro "q" requerido', 400);
    }

    const nutrition = await lookupNutrition(query);

    if (!nutrition) {
      return successResponse({ found: false, query });
    }

    const badge = getNutritionBadge(nutrition);

    return successResponse({
      found: true,
      query,
      nutrition,
      badge,
    });
  } catch (error: any) {
    console.error('Nutrition lookup error:', error);
    return errorResponse('Error al buscar datos nutricionales', 500);
  }
}

// POST /api/nutrition/lookup — Enriquecer multiples productos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return errorResponse('Lista de productos requerida', 400);
    }

    if (products.length > 10) {
      return errorResponse('Máximo 10 productos por consulta', 400);
    }

    const results = await enrichProductsNutrition(products);

    const enriched = products.map((p: any) => {
      const nutrition = results.get(p.name);
      return {
        name: p.name,
        brand: p.brand,
        nutrition,
        badge: nutrition ? getNutritionBadge(nutrition) : null,
      };
    });

    return successResponse({ products: enriched });
  } catch (error: any) {
    console.error('Nutrition enrichment error:', error);
    return errorResponse('Error al enriquecer productos', 500);
  }
}
