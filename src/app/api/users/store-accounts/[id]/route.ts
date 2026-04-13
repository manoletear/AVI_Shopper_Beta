import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { updateStoreAccountSchema } from '@/lib/validations';
import { successResponse, noContentResponse, errorResponse } from '@/lib/responses';

// GET /api/users/store-accounts/:id - Obtener detalle de una cuenta
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();

    const account = await prisma.storeAccount.findFirst({
      where: { id: params.id, userId },
      include: {
        store: {
          select: { id: true, name: true, slug: true, imageUrl: true },
        },
      },
    });

    if (!account) {
      return errorResponse('Cuenta no encontrada', 404, 'ACCOUNT_NOT_FOUND');
    }

    return successResponse({
      id: account.id,
      storeId: account.storeId,
      storeName: account.store.name,
      storeSlug: account.store.slug,
      storeImageUrl: account.store.imageUrl,
      accountEmail: account.accountEmail,
      accountName: account.accountName,
      accountPhone: account.accountPhone,
      loyaltyNumber: account.loyaltyNumber,
      isVerified: account.isVerified,
      isAutoCreated: account.isAutoCreated,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Get store account error:', error);
    return errorResponse('Error al obtener cuenta', 500);
  }
}

// PATCH /api/users/store-accounts/:id - Actualizar cuenta
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const validatedData = updateStoreAccountSchema.parse(body);

    // Verificar propiedad
    const existing = await prisma.storeAccount.findFirst({
      where: { id: params.id, userId },
    });

    if (!existing) {
      return errorResponse('Cuenta no encontrada', 404, 'ACCOUNT_NOT_FOUND');
    }

    const account = await prisma.storeAccount.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        store: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return successResponse({
      id: account.id,
      storeId: account.storeId,
      storeName: account.store.name,
      storeSlug: account.store.slug,
      accountEmail: account.accountEmail,
      accountName: account.accountName,
      accountPhone: account.accountPhone,
      loyaltyNumber: account.loyaltyNumber,
      isVerified: account.isVerified,
      isAutoCreated: account.isAutoCreated,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Update store account error:', error);
    return errorResponse('Error al actualizar cuenta', 500);
  }
}

// DELETE /api/users/store-accounts/:id - Desvincular cuenta
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await requireAuth();

    const existing = await prisma.storeAccount.findFirst({
      where: { id: params.id, userId },
    });

    if (!existing) {
      return errorResponse('Cuenta no encontrada', 404, 'ACCOUNT_NOT_FOUND');
    }

    await prisma.storeAccount.delete({
      where: { id: params.id },
    });

    return noContentResponse();
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Delete store account error:', error);
    return errorResponse('Error al desvincular cuenta', 500);
  }
}
