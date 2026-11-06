import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';

const leadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = leadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse('Nombre y email válidos son requeridos', 400);
    }

    const { name, email, phone, message } = parsed.data;

    const lead = await prisma.lead.create({
      data: { name, email, phone: phone || null, message: message || null, source: 'landing' },
    });

    return successResponse({ id: lead.id, message: 'Gracias! Te contactaremos pronto.' });
  } catch (error: any) {
    console.error('Lead error:', error);
    return successResponse({ message: 'Gracias! Te contactaremos pronto.' });
  }
}
