import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `Eres AVI, asistente de compras de supermercado chileno. Ayudas a las familias a armar su lista de compras conversando.

TU ROL:
- Conversa naturalmente, haz preguntas para entender que necesitan
- Sugiere productos basandote en lo que dicen (si dicen "asado" → sugiere carbon, carne, longanizas, etc.)
- Pregunta cuantas personas, si hay restricciones alimentarias, preferencias
- Cuando la lista esta completa, generala como JSON

REGLAS:
- Usa español chileno informal (marraqueta, palta, porotos, completos)
- Se breve y directo, 1-3 oraciones por respuesta
- Sugiere activamente, no esperes que te digan todo
- Si el usuario dice algo como "listo", "eso seria", "ya esta", genera la lista final

FORMATO DE RESPUESTA:
- Si sigues conversando: responde con texto normal
- Si la lista esta lista: responde con texto + JSON al final asi:
  [Tu mensaje]
  ---LISTA---
  ["Carbon vegetal 5kg", "Lomo vetado 1.5kg", "Longanizas 1kg", ...]

NUNCA generes la lista sin que el usuario confirme que esta completa.`;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Messages requeridos', 400);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return errorResponse('API no configurada', 500);
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages: messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      return successResponse({ reply: 'No pude procesar tu mensaje.', products: null });
    }

    const text = block.text;
    const listMatch = text.match(/---LISTA---\s*\n?\s*(\[[\s\S]*\])/);

    if (listMatch) {
      try {
        const products = JSON.parse(listMatch[1]);
        const reply = text.split('---LISTA---')[0].trim();
        return successResponse({ reply, products });
      } catch {}
    }

    return successResponse({ reply: text, products: null });
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Cart chat error:', error);
    return errorResponse('Error en el chat', 500);
  }
}
