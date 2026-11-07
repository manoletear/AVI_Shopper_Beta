import { prisma } from '@/lib/prisma';
import { requireFamilyMembership, familyErrorResponse } from '@/lib/family-auth';
import { successResponse, errorResponse } from '@/lib/responses';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { cartId: string } }
) {
  try {
    const { familyId } = await requireFamilyMembership();

    const cart = await prisma.proposedCart.findFirst({
      where: { id: params.cartId, familyId },
      include: {
        items: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!cart) {
      return errorResponse('Carro no encontrado', 404);
    }

    return successResponse({
      id: cart.id,
      storeName: cart.storeName,
      status: cart.status,
      subtotal: cart.subtotal,
      total: cart.total,
      note: cart.note,
      createdAt: cart.createdAt.toISOString(),
      items: cart.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        payable: item.payable,
        approved: item.approved ?? null,
      })),
    });
  } catch (error) {
    return familyErrorResponse(error, 'No pude cargar el carro');
  }
}
