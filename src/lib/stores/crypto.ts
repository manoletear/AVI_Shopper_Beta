import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cifrado de sesiones de supermercado (cookies) con AES-256-GCM.
 * AVI_STORE_KEY: 32 bytes aleatorios en base64 (44 chars) o hex (64 chars).
 *   Generar: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Formato guardado: v1.<iv b64url>.<tag b64url>.<ciphertext b64url> en una sola columna.
 * Nunca se guardan contraseñas; nunca se loguea el texto plano ni la clave.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const VERSION = 'v1';
/** Liga el texto cifrado a su familia y tienda: no se puede copiar una fila a otra familia. */
function aad(familyId: string, storeSlug: string): Buffer {
  return Buffer.from(`avi-store-session:${familyId}:${storeSlug}`, 'utf8');
}

export function parseStoreKey(raw: string | undefined): Buffer {
  const value = (raw || '').trim();
  let key: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) key = Buffer.from(value, 'hex');
  else if (/^[A-Za-z0-9+/_-]{43}=?$/.test(value)) key = Buffer.from(value, 'base64');
  if (!key || key.length !== 32) {
    throw new Error('AVI_STORE_KEY debe ser 32 bytes aleatorios en base64 o hex');
  }
  return key;
}

export function encryptSession(
  plaintext: string,
  ctx: { familyId: string; storeSlug: string },
  rawKey: string | undefined = process.env.AVI_STORE_KEY,
): string {
  const key = parseStoreKey(rawKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  cipher.setAAD(aad(ctx.familyId, ctx.storeSlug));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSession(
  payload: string,
  ctx: { familyId: string; storeSlug: string },
  rawKey: string | undefined = process.env.AVI_STORE_KEY,
): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('Sesión cifrada con formato inválido');
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error('Sesión cifrada con formato inválido');
  const decipher = createDecipheriv(ALGO, parseStoreKey(rawKey), iv, { authTagLength: TAG_LEN });
  decipher.setAAD(aad(ctx.familyId, ctx.storeSlug));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
}
