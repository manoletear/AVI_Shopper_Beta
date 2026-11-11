import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { generateMcpToken } from '@/lib/mcp/auth';
import { successResponse, errorResponse } from '@/lib/responses';

export const dynamic = 'force-dynamic';

/**
 * POST /api/families/token
 * Genera un nuevo token MCP para la familia del usuario.
 * Opcionalmente desactiva los tokens anteriores (rotate).
 *
 * Body: { label?: string, rotate?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const member = await prisma.familyMember.findFirst({
      where: { userId, isActive: true, role: 'master' },
      select: { familyId: true },
    });
    if (!member) return errorResponse('Solo el master de la familia puede generar tokens', 403);

    const body = await request.json().catch(() => ({}));
    const label = body.label || 'default';

    if (body.rotate) {
      await prisma.mcpToken.updateMany({
        where: { familyId: member.familyId, isActive: true },
        data: { isActive: false },
      });
    }

    const token = await generateMcpToken(member.familyId, label);

    return successResponse({
      token: `Bearer ${token}`,
      label,
      familyId: member.familyId,
      rotated: !!body.rotate,
      message: 'Token generado. Guárdalo — no se puede recuperar después.',
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Error', error.statusCode || 500);
  }
}

/**
 * DELETE /api/families/token
 * Desactiva todos los tokens MCP de la familia.
 * Body: { tokenId?: string } — si se pasa, solo desactiva ese.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const member = await prisma.familyMember.findFirst({
      where: { userId, isActive: true, role: 'master' },
      select: { familyId: true },
    });
    if (!member) return errorResponse('Solo el master puede revocar tokens', 403);

    const body = await request.json().catch(() => ({}));
    const where = body.tokenId
      ? { id: body.tokenId, familyId: member.familyId }
      : { familyId: member.familyId, isActive: true };

    const result = await prisma.mcpToken.updateMany({ where, data: { isActive: false } });

    return successResponse({ revoked: result.count });
  } catch (error: any) {
    return errorResponse(error.message || 'Error', error.statusCode || 500);
  }
}
