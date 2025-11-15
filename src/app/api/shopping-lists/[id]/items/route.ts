import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createShoppingItemSchema } from '@/lib/validations';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = createShoppingItemSchema.parse(body);

    // Check ownership
    const list = await prisma.shoppingList.findUnique({
      where: { id: params.id },
    });

    if (!list) {
      throw new NotFoundError('Lista no encontrada');
    }

    if (list.userId !== userId) {
      throw new ForbiddenError('No tienes acceso a esta lista');
    }

    // Create item
    const item = await prisma.shoppingItem.create({
      data: {
        shoppingListId: params.id,
        name: validatedData.name,
        quantity: validatedData.quantity,
        urgent: validatedData.urgent,
        productId: validatedData.productId,
      },
      include: {
        product: true,
      },
    });

    return createdResponse(item);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Create shopping item error:', error);
    return errorResponse('Error al crear ítem', 500);
  }
}
