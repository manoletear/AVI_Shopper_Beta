import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';
import { createPayment } from '@/services/flow-payment.service';

// POST /api/payments — Crear pago para una orden
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return errorResponse('orderId requerido', 400);
    }

    // Buscar la orden
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { store: true },
    });

    if (!order) {
      return errorResponse('Orden no encontrada', 404);
    }

    if (order.status !== 'pending') {
      return errorResponse('La orden ya fue procesada', 400);
    }

    // Obtener email del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return errorResponse('Usuario no encontrado', 404);
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Crear pago en Flow
    const payment = await createPayment({
      orderId: order.id,
      amount: order.total,
      email: user.email,
      subject: `AVI Shopper - Compra en ${order.store.name}`,
      urlConfirmation: `${baseUrl}/api/payments/confirm`,
      urlReturn: `${baseUrl}/dashboard?payment=completed&order=${order.id}`,
      optional: {
        storeId: order.storeId,
        storeName: order.store.name,
      },
    });

    return successResponse({
      paymentUrl: payment.url,
      token: payment.token,
      flowOrder: payment.flowOrder,
      amount: order.total,
      store: order.store.name,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Create payment error:', error);
    return errorResponse(error.message || 'Error al crear pago', 500);
  }
}
