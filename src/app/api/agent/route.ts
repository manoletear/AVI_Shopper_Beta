import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { processAgentMessage } from '@/services/agent.service';

// POST /api/agent — Enviar mensaje al agente AVI
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return errorResponse('Mensaje requerido', 400);
    }

    const result = await processAgentMessage(message, userId, history || []);

    return successResponse({
      response: result.response,
      toolsUsed: result.toolsUsed.map((t) => ({
        tool: t.tool,
        success: t.result.success,
        message: t.result.message,
      })),
    });
  } catch (error: any) {
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode, error.code);
    }
    console.error('Agent error:', error);
    const msg = error.message || 'Error del agente';
    if (msg.includes('authentication') || msg.includes('api_key') || msg.includes('401')) {
      return errorResponse('ANTHROPIC_API_KEY invalida o expirada. Revisa la configuracion en Vercel.', 503);
    }
    return errorResponse(msg, 500);
  }
}
