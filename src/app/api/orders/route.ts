import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createOrderSchema } from '@/lib/validations';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let where: any = { userId };

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          store: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    // Parse JSON items field
    const ordersWithParsedItems = orders.map(order => ({
      ...order,
      items: JSON.parse(order.items),
    }));

    return successResponse(ordersWithParsedItems, 200, {
      page,
      limit,
      total,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get orders error:', error);
    return errorResponse('Error al obtener órdenes', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = createOrderSchema.parse(body);

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        storeId: validatedData.storeId,
        items: JSON.stringify(validatedData.items),
        subtotal: validatedData.subtotal,
        delivery: validatedData.delivery,
        total: validatedData.total,
        status: 'pending',
        eta: validatedData.eta ? new Date(validatedData.eta) : null,
      },
      include: {
        store: true,
      },
    });

    // Update budget spent if there's an active budget
    const now = new Date();
    const activeBudget = await prisma.budget.findFirst({
      where: {
        userId,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (activeBudget) {
      await prisma.budget.update({
        where: { id: activeBudget.id },
        data: {
          spent: activeBudget.spent + validatedData.total,
        },
      });
    }

    return createdResponse({
      ...order,
      items: JSON.parse(order.items),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Create order error:', error);
    return errorResponse('Error al crear orden', 500);
  }
}
