/**
 * Family Resolver
 *
 * Resuelve el contexto familiar de un usuario:
 * - Lista de userIds que pertenecen a la misma familia
 * - Alergias combinadas de todos los miembros
 * - Dietas de todos los miembros
 *
 * Permite que las queries de listas, presupuestos y compras
 * funcionen a nivel de familia sin cambiar la estructura de la DB.
 */

import { prisma } from '@/lib/prisma';

interface FamilyContext {
  familyId: string | null;
  familyName: string | null;
  userIds: string[];
  allAllergies: string[];
  allDiets: string[];
  memberCount: number;
}

let cache = new Map<string, { data: FamilyContext; expires: number }>();

export function clearFamilyContextCache() {
  cache = new Map();
}

export async function getFamilyContext(userId: string): Promise<FamilyContext> {
  // Cache de 5 minutos
  const cached = cache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.data;

  const membership = await prisma.familyMember.findFirst({
    where: { userId },
    include: {
      family: {
        include: {
          members: {
            where: { isActive: true },
            select: { userId: true, allergies: true, dietType: true, dietTags: true, name: true },
          },
        },
      },
    },
  });

  if (!membership) {
    const result: FamilyContext = {
      familyId: null,
      familyName: null,
      userIds: [userId],
      allAllergies: [],
      allDiets: [],
      memberCount: 1,
    };
    cache.set(userId, { data: result, expires: Date.now() + 300000 });
    return result;
  }

  const userIds = membership.family.members
    .filter((m) => m.userId)
    .map((m) => m.userId!);

  if (!userIds.includes(userId)) userIds.push(userId);

  const allAllergies = new Set<string>();
  const allDiets = new Set<string>();

  for (const m of membership.family.members) {
    if (m.allergies) {
      try {
        const parsed = JSON.parse(m.allergies);
        if (Array.isArray(parsed)) parsed.forEach((a: string) => allAllergies.add(a));
      } catch {}
    }
    if (m.dietType) allDiets.add(m.dietType);
    for (const tag of m.dietTags || []) allDiets.add(tag);
  }

  const result: FamilyContext = {
    familyId: membership.family.id,
    familyName: membership.family.name,
    userIds,
    allAllergies: [...allAllergies],
    allDiets: [...allDiets],
    memberCount: membership.family.members.length,
  };

  cache.set(userId, { data: result, expires: Date.now() + 300000 });
  return result;
}

/**
 * Genera un filtro Prisma WHERE que incluye todos los miembros de la familia
 */
export async function familyWhere(userId: string): Promise<{ userId: { in: string[] } }> {
  const ctx = await getFamilyContext(userId);
  return { userId: { in: ctx.userIds } };
}
