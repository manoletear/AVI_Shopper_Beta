import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Token Bearer por familia para el MCP.
 *
 * AVI_MCP_TOKENS = "familyId:token,familyId:token"
 * El familyId sale del token, nunca de los argumentos de la herramienta.
 * Tokens de menos de MIN_TOKEN_LENGTH caracteres se ignoran.
 */
export const MIN_TOKEN_LENGTH = 32;

interface TokenEntry {
  familyId: string;
  digest: Buffer;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
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
    entries.push({ familyId, digest: digest(token) });
  }
  return entries;
}

/**
 * Devuelve el familyId del token o null.
 * Compara contra todas las entradas con timingSafeEqual sobre sha256,
 * sin cortar en la primera coincidencia.
 */
export function authenticateToken(
  authHeader: string | null,
  raw: string | undefined = process.env.AVI_MCP_TOKENS,
): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader);
  if (!match) return null;
  const candidate = digest(match[1]);
  let found: string | null = null;
  for (const entry of parseTokens(raw)) {
    if (timingSafeEqual(candidate, entry.digest) && found === null) {
      found = entry.familyId;
    }
  }
  return found;
}
