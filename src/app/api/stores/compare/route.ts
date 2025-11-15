import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { compareStorePrices, splitCart } from '@/services/cart.service';
import { z } from 'zod';

const compareSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
    })
  ),
  mode: z.enum(['compare', 'split']).default('compare'),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = compareSchema.parse(body);

    if (validatedData.mode === 'split') {
      // Return split cart suggestions
      const result = await splitCart(validatedData.items);
      return successResponse(result);
    } else {
      // Return price comparison across stores
      const suggestions = await compareStorePrices(validatedData.items);
      return successResponse({ suggestions });
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Compare stores error:', error);
    return errorResponse('Error al comparar tiendas', 500);
  }
}
