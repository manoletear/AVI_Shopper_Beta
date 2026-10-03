import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/responses';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

const resetCodes = new Map<string, { code: string; expires: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, code, newPassword } = body;

    if (action === 'send_code') {
      if (!email) return errorResponse('Email requerido', 400);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return successResponse({ sent: true });
      }

      const resetCode = String(randomInt(100000, 999999));
      resetCodes.set(email.toLowerCase(), {
        code: resetCode,
        expires: Date.now() + 15 * 60 * 1000,
      });

      console.log(`[Reset] Code for ${email}: ${resetCode}`);

      return successResponse({ sent: true });
    }

    if (action === 'reset') {
      if (!email || !code || !newPassword) {
        return errorResponse('Email, codigo y nueva contrasena requeridos', 400);
      }

      if (newPassword.length < 8) {
        return errorResponse('La contrasena debe tener al menos 8 caracteres', 400);
      }

      const stored = resetCodes.get(email.toLowerCase());
      if (!stored || stored.code !== code || Date.now() > stored.expires) {
        return errorResponse('Codigo invalido o expirado', 400);
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return errorResponse('Usuario no encontrado', 404);

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      resetCodes.delete(email.toLowerCase());

      return successResponse({ reset: true });
    }

    return errorResponse('Accion no reconocida', 400);
  } catch (error: any) {
    console.error('Reset password error:', error);
    return errorResponse('Error al procesar solicitud', 500);
  }
}
