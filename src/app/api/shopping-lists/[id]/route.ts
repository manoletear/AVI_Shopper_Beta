import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse, noContentResponse } from '@/lib/responses';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();

    const list = await prisma.shoppingList.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            product: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!list) {
      throw new NotFoundError('Lista no encontrada');
    }

    if (list.userId !== userId) {
      throw new ForbiddenError('No tienes acceso a esta lista');
    }

    return successResponse(list);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get shopping list error:', error);
    return errorResponse('Error al obtener lista', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

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

    // Update list
    const updatedList = await prisma.shoppingList.update({
      where: { id: params.id },
      data: { name: body.name },
      include: {
        items: true,
      },
    });

    return successResponse(updatedList);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Update shopping list error:', error);
    return errorResponse('Error al actualizar lista', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();

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

    // Delete list
    await prisma.shoppingList.delete({
      where: { id: params.id },
    });

    return noContentResponse();
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Delete shopping list error:', error);
    return errorResponse('Error al eliminar lista', 500);
  }
}
