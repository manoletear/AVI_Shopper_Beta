import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createBudgetSchema, updateBudgetSchema } from '@/lib/validations';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const current = searchParams.get('current') === 'true';

    let where: any = { userId };

    if (current) {
      const now = new Date();
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    }

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return successResponse(current ? budgets[0] : budgets);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get budgets error:', error);
    return errorResponse('Error al obtener presupuestos', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = createBudgetSchema.parse(body);

    // Create budget
    const budget = await prisma.budget.create({
      data: {
        userId,
        period: validatedData.period,
        amount: validatedData.amount,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate),
      },
    });

    return createdResponse(budget);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Create budget error:', error);
    return errorResponse('Error al crear presupuesto', 500);
  }
}
