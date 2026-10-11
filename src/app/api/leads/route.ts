import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, message } = await request.json();

    if (!name || !email) {
      return errorResponse('Nombre y email requeridos', 400);
    }

    const lead = await prisma.lead.create({
      data: { name, email, phone: phone || null, message: message || null, source: 'landing' },
    });

    return successResponse({ id: lead.id, message: 'Gracias! Te contactaremos pronto.' });
  } catch (error: any) {
    console.error('Lead error:', error);
    return successResponse({ message: 'Gracias! Te contactaremos pronto.' });
  }
}
