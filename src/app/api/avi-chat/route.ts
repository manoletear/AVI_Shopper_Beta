import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireFamilyMembership } from '@/lib/family-auth';
import { AVI_MCP_INSTRUCTIONS } from '@/lib/mcp/instructions';
import {
  getHousehold,
  getPantry,
  getPurchaseHistory,
  getLockedProducts,
  getStoreConnectionStatus,
  checkAllergensForFamily,
  comparePrices,
} from '@/lib/mcp/tools';
import {
  openList,
  addListItems,
  getList,
} from '@/services/shopping-list.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = 3;

type ToolHandler = (familyId: string, memberId: string, args: Record<string, unknown>) => Promise<unknown>;

const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: 'get_household',
    description: 'Integrantes activos, roles, alergias, dietas, mascotas y quién aprueba.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_pantry',
    description: 'Despensa con semáforo rojo/amarillo/verde, stock estimado, días restantes y calorías.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_purchase_history',
    description: 'Historial de compras. Filtrar por tienda o fecha.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Máximo de resultados (default 50)' },
        storeSlug: { type: 'string', description: 'jumbo, lider, unimarc o tottus' },
        from: { type: 'string', description: 'Fecha desde (ISO)' },
        to: { type: 'string', description: 'Fecha hasta (ISO)' },
      },
      required: [],
    },
  },
  {
    name: 'get_locked_products',
    description: 'Productos fijos (marca y formato) que la familia repite.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'compare_prices',
    description: 'Compara precios en Jumbo, Lider, Unimarc y Tottus. Incluye delivery.',
    input_schema: {
      type: 'object' as const,
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              groupKey: { type: 'string', description: 'Producto canónico' },
              quantity: { type: 'number', description: 'Cantidad' },
            },
            required: ['groupKey', 'quantity'],
          },
          description: 'Lista de productos a comparar',
        },
      },
      required: ['products'],
    },
  },
  {
    name: 'check_allergens',
    description: 'Verifica alérgenos de un producto contra las alergias de la familia.',
    input_schema: {
      type: 'object' as const,
      properties: {
        productNutritionId: { type: 'string', description: 'ID de ficha nutricional' },
        productName: { type: 'string', description: 'Nombre del producto si no tienes el ID' },
      },
      required: [],
    },
  },
  {
    name: 'get_store_connection_status',
    description: 'Estado de conexión de cada supermercado.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'open_list',
    description: 'Abre o retoma la lista de compras familiar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        targetDate: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'add_list_items',
    description: 'Agrega productos a la lista. AVI normaliza contra el historial.',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rawText: { type: 'string', description: 'Lo que dijo la persona' },
              qty: { type: 'number' },
              requestedByLabel: { type: 'string' },
            },
            required: ['rawText'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'get_list',
    description: 'Muestra la lista con precios, alérgenos y quién falta por confirmar.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
];

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  get_household: (fid) => getHousehold(fid),
  get_pantry: (fid) => getPantry(fid),
  get_purchase_history: (fid, _, args) => getPurchaseHistory(fid, args as any),
  get_locked_products: (fid) => getLockedProducts(fid),
  compare_prices: (fid, _, args) => comparePrices(fid, args as any),
  check_allergens: (fid, _, args) => {
    const pid = args.productNutritionId as string | undefined;
    const pname = args.productName as string | undefined;
    if (pid) return checkAllergensForFamily(fid, pid);
    if (pname) return checkAllergensForFamily(fid, pname);
    return Promise.resolve({ warning: 'Necesito productNutritionId o productName' });
  },
  get_store_connection_status: (fid) => getStoreConnectionStatus(fid),
  open_list: (fid, mid, args) => openList(fid, mid, args as any),
  add_list_items: async (fid, mid, args) => {
    const list = await openList(fid, mid);
    return addListItems(fid, list.id, (args as any).items, mid);
  },
  get_list: (fid) => getList(fid),
};

const TOOL_LABELS: Record<string, string> = {
  get_household: 'Revisando la familia...',
  get_pantry: 'Revisando la despensa...',
  get_purchase_history: 'Buscando en el historial...',
  get_locked_products: 'Revisando productos fijos...',
  compare_prices: 'Comparando precios...',
  check_allergens: 'Verificando alérgenos...',
  get_store_connection_status: 'Revisando tiendas...',
  open_list: 'Abriendo la lista...',
  add_list_items: 'Agregando a la lista...',
  get_list: 'Cargando la lista...',
};

export async function POST(request: NextRequest) {
  let membership;
  try {
    membership = await requireFamilyMembership();
  } catch {
    return Response.json({ error: 'No autenticado o sin familia' }, { status: 401 });
  }

  const { familyId, memberId } = membership;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message || typeof message !== 'string') {
    return Response.json({ error: 'Mensaje requerido' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 503 });
  }

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let currentMessages = [...messages];
        let toolsUsed: { tool: string; success: boolean }[] = [];

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 2048,
            system: AVI_MCP_INSTRUCTIONS + `\n\nEstás hablando con ${membership.memberName} (${membership.role}).`,
            messages: currentMessages,
            tools: TOOL_DEFS,
          });

          if (response.stop_reason === 'tool_use') {
            const toolBlocks = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            );
            const textBlocks = response.content.filter(
              (b): b is Anthropic.TextBlock => b.type === 'text'
            );

            if (textBlocks.length > 0) {
              send('text', { content: textBlocks.map((b) => b.text).join('') });
            }

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const tool of toolBlocks) {
              const handler = TOOL_HANDLERS[tool.name];
              const label = TOOL_LABELS[tool.name] || `Usando ${tool.name}...`;
              send('tool_start', { tool: tool.name, label });

              let result: unknown;
              let success = true;
              try {
                result = handler
                  ? await handler(familyId, memberId, (tool.input || {}) as Record<string, unknown>)
                  : { error: `Tool ${tool.name} no disponible en el chat` };
              } catch (error) {
                result = { error: error instanceof Error ? error.message : 'Error interno' };
                success = false;
              }

              toolsUsed.push({ tool: tool.name, success });
              send('tool_end', { tool: tool.name, success });

              toolResults.push({
                type: 'tool_result',
                tool_use_id: tool.id,
                content: JSON.stringify(result),
              });
            }

            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: response.content },
              { role: 'user', content: toolResults },
            ];
            continue;
          }

          // Final text response
          const finalText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('');

          send('text', { content: finalText });
          send('done', { toolsUsed });
          break;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error del asistente';
        send('error', { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
