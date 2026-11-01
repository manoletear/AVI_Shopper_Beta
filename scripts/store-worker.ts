/**
 * Worker de tiendas de AVI: Node + Chromium (Playwright). NO va en Vercel.
 * Correr: AVI_STORE_KEY=... AVI_STORE_WORKER_SECRET=... DATABASE_URL=... tsx scripts/store-worker.ts
 * Imagen sugerida: mcr.microsoft.com/playwright:v1.59.1-noble (Fly.io, Railway, Render o un PC de la casa).
 * Nunca hace checkout ni paga.
 */
import { createServer } from 'node:http';
import { createStoreAdapter } from '../src/lib/stores/registry';
import { prismaStoreRepo } from '../src/lib/stores/repo';
import { runWorkerJob, workerAuthorized } from '../src/lib/stores/worker';
import { parseStoreKey } from '../src/lib/stores/crypto';

parseStoreKey(process.env.AVI_STORE_KEY); // falla al arrancar si la clave es inválida
const secret = process.env.AVI_STORE_WORKER_SECRET;
if (!secret || secret.length < 32) throw new Error('AVI_STORE_WORKER_SECRET debe tener al menos 32 caracteres');

const deps = { repo: prismaStoreRepo, createAdapter: createStoreAdapter };
let busy = false; // un navegador a la vez

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/jobs') return send(404, { error: 'No encontrado' });
  if (!workerAuthorized(req.headers.authorization, secret)) return send(401, { error: 'No autorizado' });
  if (busy) return send(429, { error: 'Worker ocupado, intenta en un minuto' });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64_000) return send(413, { error: 'Demasiado grande' });
    chunks.push(chunk as Buffer);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return send(400, { error: 'JSON inválido' });
  }
  busy = true;
  try {
    const result = await runWorkerJob(payload, deps);
    send(result.status, result.body);
  } finally {
    busy = false;
  }
}).listen(Number(process.env.PORT || 8787), () => console.log('AVI store worker listo'));
