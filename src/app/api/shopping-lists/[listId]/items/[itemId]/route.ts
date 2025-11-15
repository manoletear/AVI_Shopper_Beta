import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { updateShoppingItemSchema } from '@/lib/validations';
import { successResponse, errorResponse, noContentResponse } from '@/lib/responses';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { listId: string; itemId: string } }
) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = updateShoppingItemSchema.parse(body);

    // Check ownership
    const item = await prisma.shoppingItem.findUnique({
      where: { id: params.itemId },
      include: {
        shoppingList: true,
      },
    });

    if (!item) {
      throw new NotFoundError('Ítem no encontrado');
    }

    if (item.shoppingList.userId !== userId) {
      throw new ForbiddenError('No tienes acceso a este ítem');
    }

    // Update item
    const updatedItem = await prisma.shoppingItem.update({
      where: { id: params.itemId },
      data: validatedData,
      include: {
        product: true,
      },
    });

    return successResponse(updatedItem);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Update shopping item error:', error);
    return errorResponse('Error al actualizar ítem', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { listId: string; itemId: string } }
) {
  try {
    const userId = await requireAuth();

    // Check ownership
    const item = await prisma.shoppingItem.findUnique({
      where: { id: params.itemId },
      include: {
        shoppingList: true,
      },
    });

    if (!item) {
      throw new NotFoundError('Ítem no encontrado');
    }

    if (item.shoppingList.userId !== userId) {
      throw new ForbiddenError('No tienes acceso a este ítem');
    }

    // Delete item
    await prisma.shoppingItem.delete({
      where: { id: params.itemId },
    });

    return noContentResponse();
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Delete shopping item error:', error);
    return errorResponse('Error al eliminar ítem', 500);
  }
}
