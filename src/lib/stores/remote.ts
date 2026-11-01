import type { WorkerJob } from './worker';

/**
 * Lado Vercel: Playwright no corre en funciones serverless, así que las
 * herramientas de tienda delegan al worker (AVI_STORE_WORKER_URL + AVI_STORE_WORKER_SECRET).
 * Este archivo no importa Playwright ni el adaptador.
 */

export class StoreWorkerError extends Error {}

export async function callStoreWorker(
  job: WorkerJob,
  env: { url?: string; secret?: string } = { url: process.env.AVI_STORE_WORKER_URL, secret: process.env.AVI_STORE_WORKER_SECRET },
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!env.url || !env.secret) {
    throw new StoreWorkerError('El worker de tiendas no está configurado (AVI_STORE_WORKER_URL / AVI_STORE_WORKER_SECRET)');
  }
  const response = await fetchImpl(new URL('/jobs', env.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.secret}` },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(240_000),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new StoreWorkerError(response.status === 422 && body?.error ? body.error : `El worker de tiendas respondió ${response.status}`);
  }
  return body;
}
