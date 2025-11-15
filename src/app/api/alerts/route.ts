import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';
import { z } from 'zod';

const createAlertSchema = z.object({
  type: z.enum(['budget', 'stock', 'savings', 'nutrition']),
  title: z.string(),
  message: z.string(),
  level: z.enum(['info', 'warn', 'good']),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    let where: any = { userId, dismissed: false };

    if (unreadOnly) {
      where.read = false;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(alerts);
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get alerts error:', error);
    return errorResponse('Error al obtener alertas', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = createAlertSchema.parse(body);

    // Create alert
    const alert = await prisma.alert.create({
      data: {
        userId,
        ...validatedData,
      },
    });

    return createdResponse(alert);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Create alert error:', error);
    return errorResponse('Error al crear alerta', 500);
  }
}
