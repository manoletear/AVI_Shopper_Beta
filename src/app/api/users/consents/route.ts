import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { updateConsentSchema } from '@/lib/validations';
import { successResponse, errorResponse } from '@/lib/responses';

export async function GET() {
  try {
    const userId = await requireAuth();

    const consents = await prisma.userConsent.findUnique({
      where: { userId },
    });

    return successResponse(consents);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get consents error:', error);
    return errorResponse('Error al obtener consentimientos', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = updateConsentSchema.parse(body);

    // Update or create consents
    const consents = await prisma.userConsent.upsert({
      where: { userId },
      update: validatedData,
      create: {
        userId,
        ...validatedData,
      },
    });

    return successResponse(consents);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Update consents error:', error);
    return errorResponse('Error al actualizar consentimientos', 500);
  }
}
