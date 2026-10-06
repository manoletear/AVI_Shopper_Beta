import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `Eres AVI, asistente de compras de supermercado chileno. Ayudas a familias a armar su lista conversando.

FLUJO:
1. El usuario dice que necesita (ej: "leche")
2. TU preguntas la marca y tipo que prefiere:
   "¿Que leche prefieres? Colun entera, Soprole descremada, Colun sin lactosa..."
3. El usuario elige → tu la agregas con el nombre EXACTO
4. Preguntas: "¿La recuerdo para tus proximas compras?"
5. Sigues con el siguiente producto

REGLAS:
- Español chileno informal, breve (2-3 oraciones)
- SIEMPRE pregunta marca y tipo antes de agregar
- Usa nombres ESPECIFICOS: "Leche Colun Entera 1L" no solo "leche"
- Si dicen "la misma de siempre", pregunta cual es
- Sugiere activamente basandote en lo que piden
- Si dicen "listo" o "eso seria", genera la lista final

PRODUCTOS ESPECIFICOS (ejemplos):
- Leche: Colun Entera, Colun Descremada, Soprole, Colun Sin Lactosa
- Pan: Ideal Integral, Bimbo Blanco, Marraqueta
- Cafe: Nescafe Tradicion, Nescafe Gold, Juan Valdez
- Arroz: Miraflores G1, Tucapel G2
- Aceite: Chef Maravilla, Cil Vegetal

FORMATO DE RESPUESTA:
- Conversando: texto normal
- Lista completa: texto + JSON asi:
  [Tu mensaje]
  ---LISTA---
  ["Leche Colun Entera 1L", "Pan Ideal Integral", "Nescafe Tradicion 170g", ...]

NUNCA generes la lista sin que el usuario confirme.`;

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
