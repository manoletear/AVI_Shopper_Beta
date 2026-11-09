import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

/**
 * Auth MCP por familia.
 *
 * Busca tokens en la tabla mcp_tokens (DB) primero.
 * Fallback al env var AVI_MCP_TOKENS para compatibilidad.
 * El familyId sale del token, nunca de los argumentos de la herramienta.
 */
export const MIN_TOKEN_LENGTH = 32;

function digestHex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function digestBuf(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

interface TokenEntry {
  familyId: string;
  digest: Buffer;
}

export function parseTokens(raw: string | undefined): TokenEntry[] {
  const entries: TokenEntry[] = [];
  for (const pair of (raw || '').split(',')) {
    const trimmed = pair.trim();
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const familyId = trimmed.slice(0, colon).trim();
    const token = trimmed.slice(colon + 1).trim();
    if (!familyId || token.length < MIN_TOKEN_LENGTH) continue;
    entries.push({ familyId, digest: digestBuf(token) });
  }
  return entries;
}

/**
 * Autenticación MCP. Busca primero en DB, luego en env.
 * Actualiza lastUsedAt en DB (fire-and-forget).
 */
export async function authenticateMcpToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader);
  if (!match) return null;
  const token = match[1];
  if (token.length < MIN_TOKEN_LENGTH) return null;

  const hash = digestHex(token);

  // 1. Buscar en DB
  try {
    const row = await prisma.mcpToken.findFirst({
      where: { tokenHash: hash, isActive: true },
      select: { id: true, familyId: true },
    });
    if (row) {
      prisma.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      return row.familyId;
    }
  } catch {
    // DB no disponible o tabla no creada: continuar con env
  }

  // 2. Fallback: env var AVI_MCP_TOKENS
  return authenticateToken(authHeader);
}

/**
 * Auth legacy contra env var. Se mantiene para compatibilidad y tests.
 */
export function authenticateToken(
  authHeader: string | null,
  raw: string | undefined = process.env.AVI_MCP_TOKENS,
): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader);
  if (!match) return null;
  const candidate = digestBuf(match[1]);
  let found: string | null = null;
  for (const entry of parseTokens(raw)) {
    if (timingSafeEqual(candidate, entry.digest) && found === null) {
      found = entry.familyId;
    }
  }
  return found;
}

/**
 * Genera un token MCP para una familia y lo guarda en DB.
 * Retorna el token plano (se muestra una sola vez al usuario).
 */
export async function generateMcpToken(familyId: string, label = 'default'): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const hash = digestHex(token);
  await prisma.mcpToken.create({
    data: { familyId, tokenHash: hash, label },
  });
  return token;
}
