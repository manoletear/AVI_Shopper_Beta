import { prisma } from '@/lib/prisma';
import { canManageStores, familyErrorResponse, requireFamilyMembership } from '@/lib/family-auth';
import { errorResponse, successResponse } from '@/lib/responses';
import { storeSlugSchema } from '@/lib/stores/types';

export const dynamic = 'force-dynamic';

type Context = { params: { storeSlug: string } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { familyId } = await requireFamilyMembership();
    const slug = storeSlugSchema.safeParse(params.storeSlug);
    if (!slug.success) return errorResponse('Tienda no soportada', 400);
    const row = await prisma.storeConnection.findUnique({
      where: { familyId_storeSlug: { familyId, storeSlug: slug.data } },
      select: { status: true, lastVerifiedAt: true },
    });
    return successResponse({
      storeSlug: slug.data,
      status: row?.status ?? 'disconnected',
      lastVerifiedAt: row?.lastVerifiedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return familyErrorResponse(error, 'No pude leer la conexión');
  }
}

/** Desconecta: borra la sesión cifrada de la familia de la sesión. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const membership = await requireFamilyMembership();
    if (!canManageStores(membership)) return errorResponse('Solo un adulto de la familia puede desconectar tiendas', 403);
    const slug = storeSlugSchema.safeParse(params.storeSlug);
    if (!slug.success) return errorResponse('Tienda no soportada', 400);
    const deleted = await prisma.storeConnection.deleteMany({
      where: { familyId: membership.familyId, storeSlug: slug.data },
    });
    if (deleted.count === 0) return errorResponse('Conexión no encontrada', 404);
    return successResponse({ storeSlug: slug.data, status: 'disconnected' });
  } catch (error) {
    return familyErrorResponse(error, 'No pude desconectar la tienda');
  }
}
