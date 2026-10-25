import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { errorResponse, successResponse } from '@/lib/responses';
import { isBasicStep } from '@/lib/onboarding/basic';
import { saveBasicStep } from '@/services/household/basic-onboarding';

export async function POST(request: NextRequest, context: { params: { step: string } }) {
  try {
    const userId = await requireAuth();
    const step = context.params.step;
    if (!isBasicStep(step)) return errorResponse('Paso desconocido', 400, 'VALIDATION_ERROR');
    const body = await request.json();
    const result = await saveBasicStep(userId, step, body);
    if (!result.ok) return errorResponse(result.error, 400, 'VALIDATION_ERROR');
    return successResponse(result.state);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Onboarding step error:', error);
    return errorResponse('No pude guardar el paso', 500);
  }
}
