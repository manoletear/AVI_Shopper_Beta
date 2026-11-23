import { NextRequest } from 'next/server';
import { redeemInviteCode } from '@/lib/mcp/auth';

export const dynamic = 'force-dynamic';

const MCP_URL = 'https://avi-shopper-beta.vercel.app/api/mcp';
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;

const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function resetRateLimit(ip: string) {
  attempts.delete(ip);
}

// Limpiar entradas viejas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * POST /api/mcp/redeem
 * Endpoint público para canjear un código de invitación.
 * NO requiere Bearer token — es para bots nuevos que aún no tienen uno.
 *
 * Body: { "code": "abc123..." }
 * Respuesta exitosa: { token, familyId, mcpUrl, memberName, role }
 * Respuesta error: { error: "Código inválido o vencido" }
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: 'Demasiados intentos. Espera 15 minutos.' },
      { status: 429 },
    );
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const code = body?.code?.trim();
  if (!code) {
    return Response.json({ error: 'Falta el código de invitación' }, { status: 400 });
  }

  try {
    const result = await redeemInviteCode(code);
    resetRateLimit(ip);
    return Response.json({
      success: true,
      token: `Bearer ${result.token}`,
      familyId: result.familyId,
      memberName: result.memberName,
      role: result.role,
      mcpUrl: MCP_URL,
      message: `¡Bienvenida ${result.memberName}! Guarda este token — no se puede recuperar después. Úsalo como Bearer token en tu conector MCP.`,
    });
  } catch (error) {
    // Respuesta genérica: no revelar si el código existe, está usado o venció
    return Response.json(
      { error: 'Código inválido o vencido' },
      { status: 400 },
    );
  }
}
