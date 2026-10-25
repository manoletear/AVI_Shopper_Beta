import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { errorResponse, successResponse } from '@/lib/responses';
import { completeBasicOnboarding, getBasicOnboarding } from '@/services/household/basic-onboarding';

export async function GET() {
  try {
    const userId = await requireAuth();
    return successResponse(await getBasicOnboarding(userId));
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Onboarding basic get error:', error);
    return errorResponse('No pude cargar el hogar', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const result = await completeBasicOnboarding(userId, body);
    if (!result.ok) return errorResponse(result.error, 400, 'VALIDATION_ERROR');
    return successResponse(result.state);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Onboarding basic save error:', error);
    return errorResponse('No pude guardar el hogar', 500);
  }
}
