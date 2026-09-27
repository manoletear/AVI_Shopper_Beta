import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPaymentStatus } from '@/services/flow-payment.service';

// POST /api/payments/confirm — Webhook de Flow (confirmación de pago)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;

    if (!token) {
      return new Response('Token requerido', { status: 400 });
    }

    // Consultar estado real en Flow
    const paymentStatus = await getPaymentStatus(token);

    if (paymentStatus.status === 2) {
      // Pago exitoso — actualizar orden
      await prisma.order.update({
        where: { id: paymentStatus.commerceOrder },
        data: {
          status: 'confirmed',
          updatedAt: new Date(),
        },
      });

      // Actualizar presupuesto si existe
      const order = await prisma.order.findUnique({
        where: { id: paymentStatus.commerceOrder },
      });

      if (order) {
        const now = new Date();
        const budget = await prisma.budget.findFirst({
          where: {
            userId: order.userId,
            startDate: { lte: now },
            endDate: { gte: now },
          },
        });

        if (budget) {
          await prisma.budget.update({
            where: { id: budget.id },
            data: { spent: budget.spent + order.total },
          });
        }

        // Crear alerta de confirmacion
        await prisma.alert.create({
          data: {
            userId: order.userId,
            type: 'savings',
            title: 'Pago confirmado',
            message: `Tu pago de $${paymentStatus.amount.toLocaleString('es-CL')} fue procesado exitosamente.`,
            level: 'good',
          },
        });
      }
    } else if (paymentStatus.status === 3 || paymentStatus.status === 4) {
      // Pago rechazado o anulado
      await prisma.order.update({
        where: { id: paymentStatus.commerceOrder },
        data: {
          status: paymentStatus.status === 3 ? 'cancelled' : 'cancelled',
          updatedAt: new Date(),
        },
      });
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return new Response('Error', { status: 500 });
  }
}
