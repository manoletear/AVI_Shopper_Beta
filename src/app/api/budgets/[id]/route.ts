import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const budget = await prisma.budget.findFirst({
      where: { id: params.id, userId },
    });

    if (!budget) {
      return errorResponse('Presupuesto no encontrado', 404);
    }

    const updated = await prisma.budget.update({
      where: { id: params.id },
      data: {
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.period !== undefined && { period: body.period }),
      },
    });

    return successResponse(updated);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Update budget error:', error);
    return errorResponse('Error al actualizar presupuesto', 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();

    const budget = await prisma.budget.findFirst({
      where: { id: params.id, userId },
    });

    if (!budget) {
      return errorResponse('Presupuesto no encontrado', 404);
    }

    await prisma.budget.delete({ where: { id: params.id } });

    return successResponse({ deleted: true });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Delete budget error:', error);
    return errorResponse('Error al eliminar presupuesto', 500);
  }
}
