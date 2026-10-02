import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Eres AVI, un asistente de compras chileno. El usuario te envia una imagen de una lista de compras (puede ser escrita a mano, un screenshot de una app como UberEats/Rappi/Cornershop, un ticket de supermercado, o cualquier imagen con productos).

Tu trabajo es extraer TODOS los productos visibles en la imagen y retornarlos como un JSON array.

Reglas:
- Extrae el nombre del producto tal como aparece, pero simplificado para busqueda (ej: "Leche Colun semidescremada 1L" → "Leche Colun semidescremada")
- Si ves cantidades, incluyelas
- Si no puedes leer algo, omitelo
- Si la imagen no contiene productos de compras, retorna un array vacio
- Retorna SOLO el JSON, sin explicaciones

Formato: [{"name": "producto", "quantity": 1}, ...]`;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return errorResponse('No se recibio imagen', 400);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return errorResponse('Servicio de vision no configurado', 500);
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return errorResponse('Formato de imagen no soportado. Usa JPG, PNG o WebP.', 400);
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Extrae los productos de esta imagen como JSON array.',
            },
          ],
        },
      ],
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? {
        headers: { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID },
      } as any : {}),
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return errorResponse('No se pudo analizar la imagen', 500);
    }

    let products: Array<{ name: string; quantity: number }> = [];
    try {
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        products = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return errorResponse('Error al parsear los productos de la imagen', 500);
    }

    return successResponse({
      products,
      count: products.length,
      message: products.length > 0
        ? `AVI encontro ${products.length} producto${products.length > 1 ? 's' : ''} en la imagen`
        : 'No se encontraron productos en la imagen',
    });
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    console.error('Import list error:', error);
    return errorResponse('Error al procesar la imagen', 500);
  }
}
