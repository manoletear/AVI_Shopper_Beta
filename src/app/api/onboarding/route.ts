import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { errorResponse, successResponse } from '@/lib/responses';
import { STEP_IDS, StepId } from '@/lib/onboarding/model';
import { getOnboarding, saveOnboardingStep, updateHouseholdDefaults } from '@/services/household/persist';

export async function GET() {
  try {
    const userId = await requireAuth();
    return successResponse(await getOnboarding(userId));
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Onboarding get error:', error);
    return errorResponse('No pude cargar el hogar', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    if (body.action === 'defaults') {
      const result = await updateHouseholdDefaults(userId, body.payload);
      if (!result.ok) return errorResponse(result.error, 400, 'VALIDATION_ERROR');
      return successResponse(result.state);
    }
    const step = body.step as StepId;
    if (!STEP_IDS.includes(step)) return errorResponse('Paso desconocido', 400, 'VALIDATION_ERROR');
    const action = body.action === 'skip' ? 'skip' : 'save';
    const result = await saveOnboardingStep(userId, step, action, body.payload);
    if (!result.ok) return errorResponse(result.error, 400, 'VALIDATION_ERROR');
    return successResponse(result.state);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Onboarding save error:', error);
    return errorResponse('No pude guardar el hogar', 500);
  }
}
