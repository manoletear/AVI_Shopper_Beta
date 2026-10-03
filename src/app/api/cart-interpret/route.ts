import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `Eres AVI, asistente de compras de supermercado chileno. El usuario te dice lo que necesita y tu generas la lista de productos para buscar en el supermercado.

Reglas CRITICAS:
- Genera nombres ESPECIFICOS para busqueda en supermercado, nunca genericos
  MAL: "Carbon" → puede confundirse con carbon activado de cosmeticos
  BIEN: "Carbon para parrilla", "Carbon vegetal asado"
  MAL: "Agua" → muy generico
  BIEN: "Agua mineral 1.5L"
- Usa nombres chilenos: marraqueta (no bolillo), palta (no aguacate), porotos (no frijoles)
- Cada producto debe ser buscable en Jumbo/Lider/Unimarc
- Ajusta cantidades segun personas si lo mencionan
- Incluye cantidades razonables (ej: "Lomo vetado 1.5kg", "Pan de completo 8 unidades")
- Responde SOLO con JSON, sin texto

Formato: {"products": ["Carbon vegetal para parrilla 5kg", "Lomo vetado 1.5kg", "Longanizas de cerdo 1kg", ...], "message": "Lista para asado de 8 personas: 15 productos"}`;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { text } = await request.json();

    if (!text?.trim()) return errorResponse('Texto requerido', 400);

    const isProductList = text.includes(',') || text.split(/[\r\n]+/).filter((s: string) => s.trim()).length > 2;

    if (isProductList) {
      const products = text.split(/[\r\n,]+/).map((s: string) => s.trim()).filter(Boolean);
      return successResponse({ products, message: null, interpreted: false });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const products = [text.trim()];
      return successResponse({ products, message: null, interpreted: false });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      return successResponse({ products: [text], message: null, interpreted: false });
    }

    try {
      const match = block.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return successResponse({
          products: parsed.products || [text],
          message: parsed.message || null,
          interpreted: true,
        });
      }
    } catch {}

    return successResponse({ products: [text], message: null, interpreted: false });
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Cart interpret error:', error);
    return errorResponse('Error al interpretar', 500);
  }
}
