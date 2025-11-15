import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { createProductSchema } from '@/lib/validations';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (category) {
      where.category = category;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          prices: {
            include: {
              store: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    return successResponse(products, 200, {
      page,
      limit,
      total,
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Get products error:', error);
    return errorResponse('Error al obtener productos', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    // Validate input
    const validatedData = createProductSchema.parse(body);

    // Create product
    const product = await prisma.product.create({
      data: validatedData,
    });

    return createdResponse(product);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Create product error:', error);
    return errorResponse('Error al crear producto', 500);
  }
}
