import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createShoppingListSchema } from '@/lib/validations';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';
import { familyWhere } from '@/lib/family';

export async function GET() {
  try {
    const userId = await requireAuth();
    const where = await familyWhere(userId);

    const lists = await prisma.shoppingList.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return successResponse(lists);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get shopping lists error:', error);
    return errorResponse('Error al obtener listas', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = createShoppingListSchema.parse(body);

    // Create shopping list
    const list = await prisma.shoppingList.create({
      data: {
        userId,
        name: validatedData.name || 'Mi lista',
      },
      include: {
        items: true,
      },
    });

    return createdResponse(list);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      const issues = error.issues || error.errors || []; return errorResponse(issues[0]?.message || 'Datos invalidos', 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Create shopping list error:', error);
    return errorResponse('Error al crear lista', 500);
  }
}
