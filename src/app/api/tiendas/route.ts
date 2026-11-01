import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canManageStores, familyErrorResponse, requireFamilyMembership } from '@/lib/family-auth';
import { errorResponse, successResponse } from '@/lib/responses';
import { storeSlugSchema } from '@/lib/stores/types';
import { STORE_NAMES } from '@/types/nutrition';

export const dynamic = 'force-dynamic';

const STORE_LABELS: Record<(typeof STORE_NAMES)[number], string> = {
  jumbo: 'Jumbo',
  lider: 'Lider',
  unimarc: 'Unimarc',
  tottus: 'Tottus',
};

const connectInput = z.object({ storeSlug: storeSlugSchema });

/** Estado de conexión por tienda de la familia de la sesión. Nunca devuelve la sesión cifrada. */
export async function GET() {
  try {
    const { familyId, role, isApprover } = await requireFamilyMembership();
    const rows = await prisma.storeConnection.findMany({
      where: { familyId },
      select: { storeSlug: true, status: true, lastVerifiedAt: true, createdAt: true },
    });
    const bySlug = new Map(rows.map((row) => [row.storeSlug, row]));
    const stores = STORE_NAMES.map((slug) => {
      const row = bySlug.get(slug);
      return {
        slug,
        name: STORE_LABELS[slug],
        status: row?.status ?? 'disconnected',
        lastVerifiedAt: row?.lastVerifiedAt?.toISOString() ?? null,
        connectedAt: row?.createdAt.toISOString() ?? null,
      };
    });
    return successResponse({ stores, canManage: canManageStores({ role, isApprover }) });
  } catch (error) {
    return familyErrorResponse(error, 'No pude cargar las tiendas');
  }
}

/**
 * Solicita conectar una tienda: deja la conexión en "pending" para el worker.
 * La web nunca pide ni guarda contraseñas; solo el worker guarda cookies cifradas.
 */
export async function POST(request: Request) {
  try {
    const membership = await requireFamilyMembership();
    if (!canManageStores(membership)) return errorResponse('Solo un adulto de la familia puede conectar tiendas', 403);
    const parsed = connectInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse('Tienda no soportada', 400);
    const { storeSlug } = parsed.data;
    const { familyId } = membership;

    const existing = await prisma.storeConnection.findUnique({
      where: { familyId_storeSlug: { familyId, storeSlug } },
      select: { status: true },
    });
    if (existing?.status === 'active') return errorResponse('Ya tienes una conexión activa con esta tienda', 409);

    await prisma.storeConnection.upsert({
      where: { familyId_storeSlug: { familyId, storeSlug } },
      create: { familyId, storeSlug, encryptedSession: '', status: 'pending' },
      update: { status: 'pending' },
    });
    return successResponse(
      { storeSlug, status: 'pending', message: 'Conexión solicitada. Abre sesión en el worker de tu PC para completarla.' },
      201,
    );
  } catch (error) {
    return familyErrorResponse(error, 'No pude iniciar la conexión');
  }
}
