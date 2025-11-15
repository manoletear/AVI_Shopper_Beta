import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
    });

    return successResponse(stores);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get stores error:', error);
    return errorResponse('Error al obtener tiendas', 500);
  }
}
