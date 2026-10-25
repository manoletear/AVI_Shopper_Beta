import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { errorResponse, successResponse } from '@/lib/responses';
import { getProgressive, saveProgressiveStep } from '@/services/household/basic-onboarding';

export async function GET() {
  try {
    const userId = await requireAuth();
    return successResponse(await getProgressive(userId));
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Progressive get error:', error);
    return errorResponse('No pude cargar el perfil', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const result = await saveProgressiveStep(userId, String(body.step || ''), body.payload);
    if (!result.ok) return errorResponse(result.error, 400, 'VALIDATION_ERROR');
    return successResponse(result.state);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Progressive save error:', error);
    return errorResponse('No pude guardar el perfil', 500);
  }
}
