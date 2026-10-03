import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';
import { getUpcomingEvents, seedNationalEvents, createBirthdayEvent } from '@/services/proactive-events.service';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const membership = await prisma.familyMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      return successResponse({ events: [], message: 'Crea tu familia primero' });
    }

    const eventCount = await prisma.familyEvent.count({
      where: { familyId: membership.familyId },
    });

    if (eventCount === 0) {
      await seedNationalEvents(membership.familyId);
    }

    const upcoming = await getUpcomingEvents(membership.familyId, days);

    return successResponse({ events: upcoming });
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Events error:', error);
    return errorResponse('Error al obtener eventos', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { action, name, month, day, type, remindDays, suggestedProducts, memberId, memberName, dateOfBirth } = body;

    const membership = await prisma.familyMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      return errorResponse('No tienes familia', 400);
    }

    if (action === 'seed') {
      const created = await seedNationalEvents(membership.familyId);
      return successResponse({ created, message: `${created} eventos chilenos agregados` });
    }

    if (action === 'add_birthday') {
      if (!memberId || !memberName || !dateOfBirth) {
        return errorResponse('memberId, memberName y dateOfBirth requeridos', 400);
      }
      await createBirthdayEvent(membership.familyId, memberId, memberName, dateOfBirth);
      return createdResponse({ message: `Cumpleanos de ${memberName} agregado` });
    }

    if (action === 'create') {
      if (!name || !month || !day) {
        return errorResponse('name, month y day requeridos', 400);
      }
      const event = await prisma.familyEvent.create({
        data: {
          familyId: membership.familyId,
          type: type || 'family',
          name,
          month,
          day,
          remindDays: remindDays || 7,
          suggestedProducts: suggestedProducts ? JSON.stringify(suggestedProducts) : null,
          isAnnual: true,
        },
      });
      return createdResponse(event);
    }

    if (action === 'delete') {
      const { eventId } = body;
      if (!eventId) return errorResponse('eventId requerido', 400);
      await prisma.familyEvent.delete({ where: { id: eventId } });
      return successResponse({ deleted: true });
    }

    return errorResponse('Accion no reconocida', 400);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Events error:', error);
    return errorResponse('Error en eventos', 500);
  }
}
