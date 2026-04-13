import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createStoreAccountSchema, autoCreateStoreAccountSchema } from '@/lib/validations';
import { successResponse, createdResponse, errorResponse } from '@/lib/responses';

// GET /api/users/store-accounts - Listar cuentas vinculadas
export async function GET() {
  try {
    const userId = await requireAuth();

    const accounts = await prisma.storeAccount.findMany({
      where: { userId },
      include: {
        store: {
          select: { id: true, name: true, slug: true, imageUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = accounts.map((a) => ({
      id: a.id,
      storeId: a.storeId,
      storeName: a.store.name,
      storeSlug: a.store.slug,
      storeImageUrl: a.store.imageUrl,
      accountEmail: a.accountEmail,
      accountName: a.accountName,
      accountPhone: a.accountPhone,
      loyaltyNumber: a.loyaltyNumber,
      isVerified: a.isVerified,
      isAutoCreated: a.isAutoCreated,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));

    return successResponse(data);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Get store accounts error:', error);
    return errorResponse('Error al obtener cuentas de tiendas', 500);
  }
}

// POST /api/users/store-accounts - Vincular cuenta existente
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const validatedData = createStoreAccountSchema.parse(body);

    // Verificar que la tienda existe
    const store = await prisma.store.findUnique({
      where: { id: validatedData.storeId },
    });

    if (!store) {
      return errorResponse('Tienda no encontrada', 404, 'STORE_NOT_FOUND');
    }

    // Verificar que no exista ya una cuenta para esta tienda
    const existing = await prisma.storeAccount.findUnique({
      where: {
        userId_storeId: { userId, storeId: validatedData.storeId },
      },
    });

    if (existing) {
      return errorResponse(
        'Ya tienes una cuenta vinculada a esta tienda',
        409,
        'ACCOUNT_EXISTS'
      );
    }

    const account = await prisma.storeAccount.create({
      data: {
        userId,
        storeId: validatedData.storeId,
        accountEmail: validatedData.accountEmail,
        accountName: validatedData.accountName,
        accountPhone: validatedData.accountPhone,
        loyaltyNumber: validatedData.loyaltyNumber,
        isAutoCreated: false,
        status: 'active',
      },
      include: {
        store: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return createdResponse({
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
    console.error('Create store account error:', error);
    return errorResponse('Error al vincular cuenta', 500);
  }
}

// PUT /api/users/store-accounts - Auto-crear cuenta con datos del usuario
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    const { storeId } = autoCreateStoreAccountSchema.parse(body);

    // Verificar que la tienda existe
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return errorResponse('Tienda no encontrada', 404, 'STORE_NOT_FOUND');
    }

    // Verificar que no exista ya
    const existing = await prisma.storeAccount.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });

    if (existing) {
      return errorResponse(
        'Ya tienes una cuenta vinculada a esta tienda',
        409,
        'ACCOUNT_EXISTS'
      );
    }

    // Obtener datos del usuario para auto-crear
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      return errorResponse('Usuario no encontrado', 404);
    }

    const account = await prisma.storeAccount.create({
      data: {
        userId,
        storeId,
        accountEmail: user.email,
        accountName: user.name,
        isAutoCreated: true,
        status: 'pending',
      },
      include: {
        store: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return createdResponse({
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
    console.error('Auto-create store account error:', error);
    return errorResponse('Error al crear cuenta automáticamente', 500);
  }
}
