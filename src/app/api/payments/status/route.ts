import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { getPaymentStatus } from '@/services/flow-payment.service';

// GET /api/payments/status?token=xxx — Consultar estado de pago
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return errorResponse('Parámetro "token" requerido', 400);
    }

    const status = await getPaymentStatus(token);

    return successResponse({
      orderId: status.commerceOrder,
      flowOrder: status.flowOrder,
      status: status.status,
      statusText: status.statusText,
      amount: status.amount,
      paymentDate: status.paymentDate,
      paymentMethod: status.paymentMethod,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Payment status error:', error);
    return errorResponse('Error al consultar estado del pago', 500);
  }
}
