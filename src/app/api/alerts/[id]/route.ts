import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse, noContentResponse } from '@/lib/responses';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Check ownership
    const alert = await prisma.alert.findUnique({
      where: { id: params.id },
    });

    if (!alert) {
      throw new NotFoundError('Alerta no encontrada');
    }

    if (alert.userId !== userId) {
      throw new ForbiddenError('No tienes acceso a esta alerta');
    }

    // Update alert
    const updatedAlert = await prisma.alert.update({
      where: { id: params.id },
      data: {
        read: body.read !== undefined ? body.read : alert.read,
        dismissed: body.dismissed !== undefined ? body.dismissed : alert.dismissed,
      },
    });

    return successResponse(updatedAlert);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Update alert error:', error);
    return errorResponse('Error al actualizar alerta', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();

    // Check ownership
    const alert = await prisma.alert.findUnique({
      where: { id: params.id },
    });

    if (!alert) {
      throw new NotFoundError('Alerta no encontrada');
    }

    if (alert.userId !== userId) {
      throw new ForbiddenError('No tienes acceso a esta alerta');
    }

    // Delete alert
    await prisma.alert.delete({
      where: { id: params.id },
    });

    return noContentResponse();
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Delete alert error:', error);
    return errorResponse('Error al eliminar alerta', 500);
  }
}
