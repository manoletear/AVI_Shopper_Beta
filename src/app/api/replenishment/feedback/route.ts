import { z } from 'zod';
import { requireAuth } from '@/lib/session';
import { errorResponse, successResponse } from '@/lib/responses';
import { recordAlertFeedback } from '@/services/consumption/sync';

const schema = z.object({
  alertId: z.string().min(1).max(80),
  kind: z.enum(['ya_tengo', 'se_acabo_antes', 'no_compro_mas', 'cantidad']),
  stockReported: z.number().nonnegative().max(10000).optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    const body = schema.parse(await request.json());
    const result = await recordAlertFeedback({
      alertId: body.alertId,
      userId,
      kind: body.kind,
      stockReported: body.stockReported,
    });
    return successResponse(result);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode);
    if (error.name === 'ZodError') return errorResponse('Datos inválidos', 400);
    console.error('Feedback error:', error);
    return errorResponse('No pude guardar la corrección', 500);
  }
}
