import { prisma } from '@/lib/prisma';
import { requireFamilyMembership, familyErrorResponse } from '@/lib/family-auth';
import { successResponse, errorResponse } from '@/lib/responses';
import { callStoreWorker, StoreWorkerError } from '@/lib/stores/remote';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: { cartId: string } }
) {
  try {
    const { familyId } = await requireFamilyMembership();

    const cart = await prisma.proposedCart.findFirst({
      where: { id: params.cartId, familyId },
      select: { id: true, storeSlug: true, storeName: true, status: true },
    });

    if (!cart) {
      return errorResponse('Carro no encontrado', 404);
    }

    if (cart.status !== 'approved') {
      return errorResponse(`El carro debe estar aprobado primero (estado: "${cart.status}")`, 400);
    }

    // Check store connection
    const connection = await prisma.storeConnection.findUnique({
      where: { familyId_storeSlug: { familyId, storeSlug: cart.storeSlug } },
      select: { status: true },
    });

    if (!connection || connection.status !== 'active') {
      return errorResponse(
        `No tienes cuenta de ${cart.storeName} conectada. Ve a Ajustes → Tiendas para conectarla.`,
        422,
        'NO_STORE_CONNECTION'
      );
    }

    // Delegate to worker
    const result = await callStoreWorker({ op: 'fill_cart', familyId, cartId: cart.id });

    return successResponse(result);
  } catch (error) {
    if (error instanceof StoreWorkerError) {
      return errorResponse(error.message, 502, 'WORKER_ERROR');
    }
    return familyErrorResponse(error, 'No pude armar el carro en la tienda');
  }
}
