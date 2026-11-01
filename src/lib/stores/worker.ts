import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { connectStore, fillCart, getDeliveryWindows, StoreToolError, type StoreDeps } from './fill-cart';
import { addressInputSchema, loginInputSchema, storeSlugSchema } from './types';

/**
 * Contrato HTTP entre el MCP (Vercel) y el worker de tiendas (Node + Chromium).
 * El familyId lo pone el MCP desde el token; el worker confía solo en el secreto compartido.
 */

export const workerJobSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('fill_cart'), familyId: z.string().min(1), cartId: z.string().min(1) }),
  z.object({
    op: z.literal('get_delivery_windows'),
    familyId: z.string().min(1),
    store: storeSlugSchema,
    address: addressInputSchema,
  }),
  z.object({ op: z.literal('connect_store'), familyId: z.string().min(1), store: storeSlugSchema, credentials: loginInputSchema }),
]);
export type WorkerJob = z.infer<typeof workerJobSchema>;

export const MIN_WORKER_SECRET = 32;

export function workerAuthorized(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_WORKER_SECRET || !header) return false;
  const match = /^Bearer\s+(\S+)$/.exec(header.trim());
  if (!match) return false;
  const a = createHash('sha256').update(match[1]).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function runWorkerJob(input: unknown, deps: StoreDeps): Promise<{ status: number; body: unknown }> {
  const parsed = workerJobSchema.safeParse(input);
  if (!parsed.success) return { status: 400, body: { error: 'Trabajo inválido' } };
  const job = parsed.data;
  try {
    switch (job.op) {
      case 'fill_cart':
        return { status: 200, body: await fillCart(job.familyId, job.cartId, deps) };
      case 'get_delivery_windows':
        return { status: 200, body: await getDeliveryWindows(job.familyId, job.store, job.address, deps) };
      case 'connect_store':
        return { status: 200, body: await connectStore(job.familyId, job.store, job.credentials, deps) };
    }
  } catch (error) {
    if (error instanceof StoreToolError) return { status: 422, body: { error: error.message } };
    console.error('store worker job failed:', job.op, error instanceof Error ? error.name : 'unknown');
    return { status: 500, body: { error: 'Error interno del worker' } };
  }
}
