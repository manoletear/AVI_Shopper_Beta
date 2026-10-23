import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { ForbiddenError } from '@/lib/errors';
import { isAdminEmail } from '@/services/catalog/access';
import { listCatalogQueue, resolveCatalogReview } from '@/services/catalog/admin';
import { ReviewAction } from '@/services/catalog/review';

async function requireAdmin() {
  const userId = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!isAdminEmail(user?.email)) {
    throw new ForbiddenError('No tienes permiso para revisar el catálogo');
  }
  return userId;
}

export async function GET() {
  try {
    await requireAdmin();
    return successResponse(await listCatalogQueue());
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    return errorResponse('No pude cargar el catálogo', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAdmin();
    const body = await request.json();
    const action = body.action as ReviewAction;
    if (action !== 'confirm' && action !== 'reject' && action !== 'merge') {
      return errorResponse('Acción no reconocida', 400);
    }
    if (!body.reviewId) return errorResponse('Falta la ficha', 400);
    const result = await resolveCatalogReview(userId, {
      action,
      reviewId: String(body.reviewId),
      canonicalId: body.canonicalId ? String(body.canonicalId) : null,
      note: body.note ? String(body.note) : null,
    });
    return successResponse(result);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    return errorResponse(error.message || 'No pude guardar la revisión', 500);
  }
}
