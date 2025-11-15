import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { registerSchema } from '@/lib/validations';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';
import { ConflictError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new ConflictError('El email ya está registrado');
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        consents: {
          create: {
            precios: true,
            consumo: true,
            salud: false,
          },
        },
        preferences: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return createdResponse(user);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }

    console.error('Register error:', error);
    return errorResponse('Error al registrar usuario', 500);
  }
}
