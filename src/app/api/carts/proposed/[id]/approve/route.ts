import { requireAuth } from '@/lib/session';
import { errorResponse, successResponse } from '@/lib/responses';
import { approveProposedCart } from '@/services/consumption/sync';

export async function POST(_request: Request, context: { params: { id: string } }) {
  try {
    const userId = await requireAuth();
    const cart = await approveProposedCart(context.params.id, userId);
    return successResponse({
      id: cart.id,
      status: cart.status,
      storeName: cart.storeName,
      total: cart.total,
      note: cart.note,
    });
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode);
    console.error('Approve cart error:', error);
    return errorResponse('No pude aprobar el carro', 500);
  }
}
