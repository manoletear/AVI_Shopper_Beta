import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const MIN_TOKEN_LENGTH = 32;
const INVITE_EXPIRY_MS = 72 * 3600 * 1000;

export type McpRole = 'approver' | 'member' | 'viewer';

export interface McpIdentity {
  familyId: string;
  memberId: string | null;
  memberName: string | null;
  role: McpRole;
}

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
 * Autenticación MCP. Busca en member_tokens → mcp_tokens (legacy) → env var.
 * Retorna la identidad completa: familia + integrante + rol.
 */
export async function authenticateMcpToken(authHeader: string | null): Promise<McpIdentity | null> {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader);
  if (!match) return null;
  const token = match[1];
  if (token.length < MIN_TOKEN_LENGTH) return null;

  const hash = digestHex(token);

  // 1. member_tokens (por integrante, con rol)
  try {
    const row = await prisma.memberToken.findFirst({
      where: { tokenHash: hash, revokedAt: null },
      select: { id: true, familyId: true, memberId: true, role: true, member: { select: { name: true } } },
    });
    if (row) {
      prisma.memberToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      return {
        familyId: row.familyId,
        memberId: row.memberId,
        memberName: row.member.name,
        role: row.role as McpRole,
      };
    }
  } catch { /* tabla no creada aún: continuar */ }

  // 2. mcp_tokens (legacy por familia)
  try {
    const row = await prisma.mcpToken.findFirst({
      where: { tokenHash: hash, isActive: true },
      select: { id: true, familyId: true },
    });
    if (row) {
      prisma.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      return { familyId: row.familyId, memberId: null, memberName: null, role: 'approver' };
    }
  } catch { /* continuar */ }

  // 3. AVI_MCP_TOKENS env var (deprecado)
  const familyId = authenticateToken(authHeader);
  if (familyId) {
    console.warn('[mcp-auth] Token legacy por env var. Migrar a member_tokens.');
    return { familyId, memberId: null, memberName: null, role: 'approver' };
  }

  return null;
}

/** Auth legacy contra env var. Se mantiene para compatibilidad y tests. */
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

/** Genera un token personal y lo guarda en member_tokens. Retorna el token plano (una sola vez). */
export async function generateMemberToken(
  familyId: string,
  memberId: string,
  role: McpRole = 'member',
  label = 'default',
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.memberToken.create({
    data: { familyId, memberId, tokenHash: digestHex(token), label, role },
  });
  return token;
}

/** Genera un código de invitación que vence en 72 h. */
export async function generateInviteCode(
  familyId: string,
  memberId: string,
  role: McpRole = 'member',
): Promise<string> {
  const code = randomBytes(24).toString('base64url');
  await prisma.memberInvite.create({
    data: {
      familyId,
      memberId,
      codeHash: digestHex(code),
      role,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
    },
  });
  return code;
}

/** Redime una invitación: crea el member_token y marca la invitación como usada. */
export async function redeemInviteCode(
  code: string,
): Promise<{ token: string; familyId: string; memberId: string; role: string }> {
  const hash = digestHex(code);
  const invite = await prisma.memberInvite.findFirst({
    where: { codeHash: hash, usedAt: null },
    include: { member: { select: { name: true } } },
  });
  if (!invite) throw new Error('Código de invitación inválido o ya usado');
  if (invite.expiresAt < new Date()) throw new Error('La invitación expiró. Pide una nueva al aprobador.');

  const token = await generateMemberToken(invite.familyId, invite.memberId, invite.role as McpRole, invite.member.name);
  await prisma.memberInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });

  return { token, familyId: invite.familyId, memberId: invite.memberId, role: invite.role };
}

/** DEPRECATED: Genera token legacy en mcp_tokens. Usar generateMemberToken. */
export async function generateMcpToken(familyId: string, label = 'default'): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.mcpToken.create({ data: { familyId, tokenHash: digestHex(token), label } });
  return token;
}
