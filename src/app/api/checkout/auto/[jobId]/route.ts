import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { hyperbrowserFromEnv } from '@/services/cart-agent';

export const dynamic = 'force-dynamic';

const JOB_ID = /^[A-Za-z0-9_-]{6,80}$/;

function readTotal(finalResult: string | null | undefined): number | undefined {
  if (!finalResult) return undefined;
  const start = finalResult.indexOf('{');
  const end = finalResult.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const data = JSON.parse(finalResult.slice(start, end + 1)) as { total?: number };
    return typeof data.total === 'number' ? Math.round(data.total) : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: { jobId: string } }
) {
  try {
    await requireAuth();
    const jobId = context.params.jobId;
    if (!JOB_ID.test(jobId)) {
      return errorResponse('Tarea inválida', 400);
    }
    const client = hyperbrowserFromEnv();
    if (!client) {
      return errorResponse(
        'Falta HYPERBROWSER_API_KEY. Créala en https://www.hyperbrowser.ai (plan gratis) y ponla en Vercel.',
        503,
        'MISSING_HYPERBROWSER_API_KEY'
      );
    }
    const task = await client.getTask(jobId);
    const remote = task.status || 'running';
    const status = remote === 'completed' ? 'ready' : remote === 'failed' || remote === 'stopped' ? 'failed' : 'running';
    const total = readTotal(task.finalResult);
    return successResponse({
      jobId: task.jobId,
      status,
      remoteStatus: remote,
      liveUrl: task.liveUrl,
      totalEstimated: total ?? null,
      message: status === 'ready'
        ? 'El navegador dejó el carrito listo. Ábrelo y paga tú. AVI no paga.'
        : status === 'failed'
          ? (task.error || 'El navegador no pudo terminar el carrito.')
          : 'AVI sigue armando el carrito. Todavía no paga.',
      paymentStopped: true,
    });
  } catch (error: unknown) {
    const known = error as { statusCode?: number; message?: string; code?: string };
    if (known.statusCode) {
      return errorResponse(known.message || 'No autorizado', known.statusCode, known.code);
    }
    console.error('Checkout auto status error:', error);
    return errorResponse('No pude consultar el carrito', 500);
  }
}
