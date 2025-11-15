import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { updateUserSchema } from '@/lib/validations';
import { successResponse, errorResponse } from '@/lib/responses';

export async function GET() {
  try {
    const userId = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        consents: true,
        preferences: true,
      },
    });

    return successResponse(user);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get user error:', error);
    return errorResponse('Error al obtener usuario', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = updateUserSchema.parse(body);

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        updatedAt: true,
      },
    });

    return successResponse(user);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Update user error:', error);
    return errorResponse('Error al actualizar usuario', 500);
  }
}
