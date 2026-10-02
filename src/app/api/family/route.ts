import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';

// GET /api/family — Obtener familia del usuario
export async function GET() {
  try {
    const userId = await requireAuth();

    const membership = await prisma.familyMember.findFirst({
      where: { userId },
      include: {
        family: {
          include: {
            members: {
              include: {
                user: { select: { email: true, name: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!membership) {
      return successResponse({ family: null, message: 'No tienes familia configurada' });
    }

    return successResponse({
      family: membership.family,
      myRole: membership.role,
      inviteCode: membership.family.inviteCode,
    });
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    return errorResponse('Error al obtener familia', 500);
  }
}

// POST /api/family — Crear familia o unirse con codigo
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { action, familyName, inviteCode, member } = body;

    // Verificar que no tenga familia ya
    const existing = await prisma.familyMember.findFirst({ where: { userId } });

    if (action === 'create') {
      if (existing) return errorResponse('Ya perteneces a una familia', 400);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const family = await prisma.family.create({
        data: {
          name: familyName || 'Mi Familia',
          members: {
            create: {
              userId,
              name: user?.name || 'Yo',
              role: 'master',
              type: 'person',
            },
          },
        },
        include: { members: true },
      });

      return createdResponse({ family, message: 'Familia creada. Comparte el codigo para invitar miembros.' });
    }

    if (action === 'join') {
      if (existing) return errorResponse('Ya perteneces a una familia', 400);
      if (!inviteCode) return errorResponse('Codigo de invitacion requerido', 400);

      const family = await prisma.family.findUnique({ where: { inviteCode } });
      if (!family) return errorResponse('Codigo de invitacion invalido', 404);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      await prisma.familyMember.create({
        data: {
          familyId: family.id,
          userId,
          name: user?.name || 'Nuevo miembro',
          role: 'adult',
          type: 'person',
        },
      });

      return successResponse({ familyId: family.id, message: `Te uniste a "${family.name}"` });
    }

    if (action === 'add_member') {
      if (!existing) return errorResponse('No tienes familia', 400);
      if (existing.role !== 'master') return errorResponse('Solo el administrador puede agregar miembros', 403);
      if (!member?.name) return errorResponse('Nombre del miembro requerido', 400);

      const newMember = await prisma.familyMember.create({
        data: {
          familyId: existing.familyId,
          name: member.name,
          role: member.role || (member.type === 'pet' ? 'pet' : 'adult'),
          type: member.type || 'person',
          allergies: member.allergies ? JSON.stringify(member.allergies) : null,
          dietType: member.dietType || null,
          dateOfBirth: member.dateOfBirth || null,
          species: member.species || null,
          breed: member.breed || null,
          notes: member.notes || null,
        },
      });

      return createdResponse({ member: newMember });
    }

    if (action === 'remove_member') {
      if (!existing || existing.role !== 'master') return errorResponse('No autorizado', 403);
      if (!member?.id) return errorResponse('ID del miembro requerido', 400);

      await prisma.familyMember.delete({ where: { id: member.id } });
      return successResponse({ message: 'Miembro eliminado' });
    }

    return errorResponse('Accion no reconocida', 400);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    return errorResponse('Error', 500);
  }
}
