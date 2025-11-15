import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { updatePreferenceSchema } from '@/lib/validations';
import { successResponse, errorResponse } from '@/lib/responses';

export async function GET() {
  try {
    const userId = await requireAuth();

    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    // Parse JSON fields
    const parsedPreferences = preferences
      ? {
          ...preferences,
          allergies: preferences.allergies ? JSON.parse(preferences.allergies) : [],
          favorites: preferences.favorites ? JSON.parse(preferences.favorites) : [],
        }
      : null;

    return successResponse(parsedPreferences);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get preferences error:', error);
    return errorResponse('Error al obtener preferencias', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = updatePreferenceSchema.parse(body);

    // Stringify JSON fields
    const dataToUpdate: any = { ...validatedData };
    if (validatedData.allergies) {
      dataToUpdate.allergies = JSON.stringify(validatedData.allergies);
    }
    if (validatedData.favorites) {
      dataToUpdate.favorites = JSON.stringify(validatedData.favorites);
    }

    // Update or create preferences
    const preferences = await prisma.userPreference.upsert({
      where: { userId },
      update: dataToUpdate,
      create: {
        userId,
        ...dataToUpdate,
      },
    });

    // Parse JSON fields for response
    const parsedPreferences = {
      ...preferences,
      allergies: preferences.allergies ? JSON.parse(preferences.allergies) : [],
      favorites: preferences.favorites ? JSON.parse(preferences.favorites) : [],
    };

    return successResponse(parsedPreferences);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Update preferences error:', error);
    return errorResponse('Error al actualizar preferencias', 500);
  }
}
