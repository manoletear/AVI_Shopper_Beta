import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { AppError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { errorResponse } from '@/lib/responses';
import { isApprover } from '@/lib/family/approver';

/**
 * Pertenencia a la familia verificada en el servidor.
 * El familyId SIEMPRE sale de family_members."userId" = usuario de la sesión;
 * nunca de un parámetro del cliente.
 */

export interface FamilyMembership {
  userId: string;
  memberId: string;
  memberName: string;
  familyId: string;
  role: string;
  isApprover: boolean;
}

interface MemberRow {
  id: string;
  name: string;
  role: string;
  familyId: string;
}

export interface MembershipDeps {
  findMember(userId: string): Promise<MemberRow | null>;
  findSettings(familyId: string): Promise<{ approverRole?: string | null; stepState?: string | null } | null>;
}

const prismaDeps: MembershipDeps = {
  findMember: (userId) =>
    prisma.familyMember.findFirst({
      where: { userId, isActive: true, type: 'person' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, role: true, familyId: true },
    }),
  findSettings: (familyId) =>
    prisma.familySettings.findUnique({ where: { familyId }, select: { approverRole: true, stepState: true } }),
};

export async function resolveFamilyMembership(
  userId: string | null | undefined,
  deps: MembershipDeps = prismaDeps,
): Promise<FamilyMembership> {
  if (!userId) throw new UnauthorizedError('No autenticado');
  const member = await deps.findMember(userId);
  if (!member) throw new ForbiddenError('No perteneces a ninguna familia');
  const settings = await deps.findSettings(member.familyId);
  return {
    userId,
    memberId: member.id,
    memberName: member.name,
    familyId: member.familyId,
    role: member.role,
    isApprover: isApprover(member, settings),
  };
}

export async function requireFamilyMembership(): Promise<FamilyMembership> {
  const session = await getServerSession(authOptions);
  return resolveFamilyMembership(session?.user?.id);
}

/** Conectar/desconectar tiendas: adultos o quien aprueba, nunca niños. */
export function canManageStores(membership: Pick<FamilyMembership, 'role' | 'isApprover'>): boolean {
  return membership.isApprover || membership.role === 'master' || membership.role === 'adult';
}

export function assertApprover(membership: Pick<FamilyMembership, 'isApprover'>): void {
  if (!membership.isApprover) {
    throw new ForbiddenError('Solo quien aprueba el carro de la familia puede decidir sustitutos');
  }
}

/** Respuesta segura: errores conocidos con su status; el resto, mensaje genérico. */
export function familyErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AppError) return errorResponse(error.message, error.statusCode, error.code);
  console.error(fallback, error instanceof Error ? error.name : 'unknown');
  return errorResponse(fallback, 500);
}
