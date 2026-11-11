import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { generateMcpToken } from '@/lib/mcp/auth';
import { successResponse, errorResponse, createdResponse } from '@/lib/responses';

export const dynamic = 'force-dynamic';

/**
 * POST /api/families/setup
 * Crea una familia completa con un solo request.
 * Retorna el token MCP (se muestra una sola vez).
 *
 * Body: {
 *   familyName: "Familia Pérez",
 *   members: [
 *     { name: "María", role: "master", dietType?: "keto", allergies?: ["maní"] },
 *     { name: "Pedro", role: "adult" },
 *     { name: "Sofía", role: "child", ageRange: "6-12" },
 *     { name: "Max", role: "pet", type: "pet", species: "perro" }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { familyName, members } = body;

    if (!familyName || !members?.length) {
      return errorResponse('familyName y al menos un miembro son requeridos', 400);
    }

    // Check user doesn't already have a family
    const existing = await prisma.familyMember.findFirst({
      where: { userId, isActive: true },
      select: { familyId: true },
    });
    if (existing) {
      return errorResponse('Ya tienes una familia creada', 409);
    }

    // Create family + members + settings in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: {
          name: familyName,
          settings: { create: { approverRole: 'master' } },
        },
      });

      const createdMembers = [];
      for (const [i, m] of members.entries()) {
        const member = await tx.familyMember.create({
          data: {
            familyId: family.id,
            userId: i === 0 ? userId : null,
            name: m.name,
            role: m.role || 'adult',
            type: m.type || 'person',
            dietType: m.dietType || null,
            dietTags: m.dietTags || [],
            allergies: m.allergies ? JSON.stringify(m.allergies) : null,
            ageRange: m.ageRange || null,
            species: m.species || null,
          },
        });
        createdMembers.push(member);
      }

      return { family, members: createdMembers };
    });

    // Generate MCP token
    const token = await generateMcpToken(result.family.id);

    return createdResponse({
      familyId: result.family.id,
      familyName: result.family.name,
      inviteCode: result.family.inviteCode,
      membersCreated: result.members.length,
      mcp: {
        url: `${request.nextUrl.origin}/api/mcp`,
        token: `Bearer ${token}`,
        instructions: 'Usa este token en el header Authorization al conectar tu agente AI al MCP. El token se muestra una sola vez.',
      },
    });
  } catch (error: any) {
    console.error('Family setup error:', error);
    return errorResponse(error.message || 'Error al crear la familia', error.statusCode || 500);
  }
}

/**
 * GET /api/families/setup
 * Retorna el estado de la familia del usuario actual.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const member = await prisma.familyMember.findFirst({
      where: { userId, isActive: true },
      include: {
        family: {
          include: {
            members: { where: { isActive: true }, select: { id: true, name: true, role: true, type: true } },
            mcpTokens: { where: { isActive: true }, select: { id: true, label: true, createdAt: true, lastUsedAt: true } },
            _count: { select: { purchases: true } },
          },
        },
      },
    });

    if (!member) {
      return successResponse({ hasFamily: false });
    }

    return successResponse({
      hasFamily: true,
      familyId: member.familyId,
      familyName: member.family.name,
      inviteCode: member.family.inviteCode,
      members: member.family.members,
      mcpTokens: member.family.mcpTokens.map((t) => ({
        id: t.id,
        label: t.label,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        active: true,
      })),
      purchaseCount: member.family._count.purchases,
      mcpUrl: `${request.nextUrl.origin}/api/mcp`,
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Error', error.statusCode || 500);
  }
}
