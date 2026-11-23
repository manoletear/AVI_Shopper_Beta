import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { requireFamilyMembership } from '@/lib/family-auth';
import { AVI_MCP_INSTRUCTIONS } from '@/lib/mcp/instructions';
import { generateInviteCode, generateMemberToken } from '@/lib/mcp/auth';
import { isFamilyApproverById } from '@/lib/family/approver';
import {
  getHousehold,
  getPantry,
  getPurchaseHistory,
  getLockedProducts,
  getStoreConnectionStatus,
  checkAllergensForFamily,
  comparePrices,
  proposeCart,
  approveItem,
  approveCart,
  fillStoreCart,
  getStoreDeliveryWindows,
  connectStoreForFamily,
  importPurchases,
} from '@/lib/mcp/tools';
import { cancelCart, recordOrder, markDelivered, saveSubstitutionPreference } from '@/services/order-lifecycle.service';
import {
  openList,
  addListItems,
  getList,
  updateListItem,
  removeListItem,
  suggestForList,
  askHousehold,
  confirmList,
  convertListToCart,
} from '@/services/shopping-list.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = 5;

type ToolHandler = (ctx: ToolCtx, args: Record<string, unknown>) => Promise<unknown>;
interface ToolCtx { familyId: string; memberId: string; memberName: string; isApprover: boolean }

function approverOnly(ctx: ToolCtx) {
  if (!ctx.isApprover) throw new Error('Solo los aprobadores de la familia pueden hacer esto');
}

// ── Tool definitions (Anthropic format) ─────────────────────────

const obj = 'object' as const;

const TOOL_DEFS: Anthropic.Tool[] = [
  // Read tools (everyone)
  { name: 'get_household', description: 'Integrantes activos, roles, alergias, dietas, mascotas y quién aprueba.', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'get_pantry', description: 'Despensa con semáforo rojo/amarillo/verde, stock estimado, días restantes, calorías y alertas inteligentes por contexto (colación, cotidiano, asado).', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'get_purchase_history', description: 'Historial de compras. Filtrar por tienda o fecha.', input_schema: { type: obj, properties: { limit: { type: 'number' }, storeSlug: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }, required: [] } },
  { name: 'get_locked_products', description: 'Productos fijos (marca y formato) que la familia repite.', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'get_store_connection_status', description: 'Estado de conexión de cada supermercado.', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'get_list', description: 'Muestra la lista familiar con precios, alérgenos y quién falta por confirmar.', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'whoami', description: 'Muestra quién eres en esta familia.', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'get_activity', description: 'Actividad reciente de la familia.', input_schema: { type: obj, properties: { since: { type: 'string', description: 'Fecha ISO desde' } }, required: [] } },

  // Action tools (approver + member)
  { name: 'check_allergens', description: 'Verifica alérgenos de un producto contra las alergias de la familia.', input_schema: { type: obj, properties: { productNutritionId: { type: 'string' }, productName: { type: 'string' } }, required: [] } },
  { name: 'compare_prices', description: 'Compara precios en Jumbo, Lider, Unimarc y Tottus con delivery incluido.', input_schema: { type: obj, properties: { products: { type: 'array', items: { type: obj, properties: { groupKey: { type: 'string' }, quantity: { type: 'number' } }, required: ['groupKey', 'quantity'] } } }, required: ['products'] } },
  { name: 'open_list', description: 'Abre o retoma la lista de compras familiar.', input_schema: { type: obj, properties: { title: { type: 'string' }, targetDate: { type: 'string' } }, required: [] } },
  { name: 'add_list_items', description: 'Agrega productos a la lista. AVI normaliza contra el historial.', input_schema: { type: obj, properties: { items: { type: 'array', items: { type: obj, properties: { rawText: { type: 'string' }, qty: { type: 'number' }, requestedByLabel: { type: 'string' } }, required: ['rawText'] } } }, required: ['items'] } },
  { name: 'update_list_item', description: 'Actualiza un ítem de la lista (cantidad, estado, nota).', input_schema: { type: obj, properties: { itemId: { type: 'string' }, qty: { type: 'number' }, status: { type: 'string' }, note: { type: 'string' } }, required: ['itemId'] } },
  { name: 'remove_list_item', description: 'Quita un producto de la lista.', input_schema: { type: obj, properties: { itemId: { type: 'string' } }, required: ['itemId'] } },
  { name: 'suggest_for_list', description: 'AVI sugiere productos agotados de la despensa no incluidos en la lista.', input_schema: { type: obj, properties: { listId: { type: 'string' } }, required: ['listId'] } },
  { name: 'ask_household', description: 'Pregunta al resto de la familia (stock, encargos). Notifica por email.', input_schema: { type: obj, properties: { listId: { type: 'string' }, question: { type: 'string' }, toMemberIds: { type: 'array', items: { type: 'string' } } }, required: ['listId', 'question'] } },
  { name: 'import_purchases', description: 'Importa historial de compras desde Uber Eats, Jumbo, Lider, etc. Idempotente por orderRef.', input_schema: { type: obj, properties: { source: { type: 'string' }, buyer: { type: 'string' }, purchases: { type: 'array', items: { type: obj, properties: { productName: { type: 'string' }, brand: { type: 'string' }, price: { type: 'number' }, quantity: { type: 'number' }, storeSlug: { type: 'string' }, groupKey: { type: 'string' }, orderRef: { type: 'string' }, purchasedAt: { type: 'string' } }, required: ['productName', 'purchasedAt'] } } }, required: ['source', 'purchases'] } },

  // Approver-only tools
  { name: 'propose_cart', description: 'Crea un carro propuesto en un supermercado. AVI propone, la familia decide. Nunca paga.', input_schema: { type: obj, properties: { store: { type: 'string', enum: ['jumbo', 'lider', 'unimarc', 'tottus'] }, items: { type: 'array', items: { type: obj, properties: { name: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' }, unitPriceClp: { type: 'number' }, canonicalProductId: { type: 'string' }, productNutritionId: { type: 'string' } }, required: ['name', 'quantity'] } }, note: { type: 'string' }, motivo: { type: 'string', enum: ['para_la_casa', 'asado', 'cumple', 'carrete', 'dieciocho', 'navidad', 'lo_que_falto', 'colaciones'] } }, required: ['store', 'items'] } },
  { name: 'approve_item', description: 'Aprueba o rechaza un ítem del carro. Solo aprobadores.', input_schema: { type: obj, properties: { cartId: { type: 'string' }, itemId: { type: 'string' }, approverMemberId: { type: 'string' }, approved: { type: 'boolean' } }, required: ['cartId', 'itemId', 'approverMemberId', 'approved'] } },
  { name: 'approve_cart', description: 'Aprueba el carro completo. Solo aprobadores. AVI no paga.', input_schema: { type: obj, properties: { cartId: { type: 'string' }, approverMemberId: { type: 'string' }, approvePending: { type: 'boolean' } }, required: ['cartId', 'approverMemberId'] } },
  { name: 'fill_cart', description: 'Llena el carro real en la tienda con ítems aprobados. Se detiene en el carro lleno. NUNCA paga.', input_schema: { type: obj, properties: { cartId: { type: 'string' } }, required: ['cartId'] } },
  { name: 'get_delivery_windows', description: 'Horarios de despacho disponibles en la tienda.', input_schema: { type: obj, properties: { store: { type: 'string', enum: ['jumbo', 'lider', 'unimarc', 'tottus'] }, street: { type: 'string' }, number: { type: 'string' }, comuna: { type: 'string' } }, required: ['store'] } },
  { name: 'connect_store', description: 'Conecta la cuenta del supermercado. Credenciales se usan una vez y se descartan.', input_schema: { type: obj, properties: { store: { type: 'string', enum: ['jumbo', 'lider', 'unimarc', 'tottus'] }, email: { type: 'string' }, password: { type: 'string' } }, required: ['store', 'email', 'password'] } },
  { name: 'cancel_cart', description: 'Cancela un carro propuesto o aprobado. Solo aprobadores.', input_schema: { type: obj, properties: { cartId: { type: 'string' }, reason: { type: 'string' } }, required: ['cartId'] } },
  { name: 'record_order', description: 'Registra un pedido confirmado y pagado. Idempotente por orderRef. Registra las líneas REALES cobradas. Se llama DESPUÉS del pago.', input_schema: { type: obj, properties: { cartId: { type: 'string' }, store: { type: 'string' }, orderRef: { type: 'string' }, placedAt: { type: 'string' }, deliveryWindow: { type: 'string' }, lines: { type: 'array', items: { type: obj, properties: { name: { type: 'string' }, qty: { type: 'number' }, unitPrice: { type: 'integer' }, storeProductId: { type: 'string' } }, required: ['name', 'qty', 'unitPrice'] } }, subtotal: { type: 'integer' }, deliveryFee: { type: 'integer' }, discount: { type: 'integer' }, adjustments: { type: 'integer' }, total: { type: 'integer' }, paymentLast4: { type: 'string' } }, required: ['cartId', 'store', 'orderRef', 'placedAt', 'lines', 'subtotal', 'total'] } },
  { name: 'mark_delivered', description: 'Marca un pedido como entregado. Registra ajustes por faltantes o sustituciones.', input_schema: { type: obj, properties: { cartId: { type: 'string' }, adjustments: { type: 'array', items: { type: obj, properties: { name: { type: 'string' }, deliveredQty: { type: 'number' }, originalQty: { type: 'number' }, substitutedFor: { type: 'string' } }, required: ['name', 'deliveredQty'] } } }, required: ['cartId'] } },
  { name: 'accept_substitution', description: 'Guarda preferencia de sustitución (ej: gauda Soprole → gauda Colun).', input_schema: { type: obj, properties: { original: { type: 'string' }, substitute: { type: 'string' }, accepted: { type: 'boolean' } }, required: ['original', 'substitute', 'accepted'] } },
  { name: 'confirm_list', description: 'Confirma la lista de compras. Cuando todos los aprobadores confirman, se puede convertir en carro.', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'convert_list_to_cart', description: 'Convierte la lista confirmada en un carro propuesto.', input_schema: { type: obj, properties: { store: { type: 'string', enum: ['jumbo', 'lider', 'unimarc', 'tottus'] } }, required: ['store'] } },
  { name: 'invite_member', description: 'Invita a un integrante a conectar su propio bot. Genera un código de acceso (72h). Solo aprobadores.', input_schema: { type: obj, properties: { memberId: { type: 'string' }, role: { type: 'string', enum: ['approver', 'member', 'viewer'] }, label: { type: 'string' } }, required: ['memberId'] } },
  { name: 'list_member_tokens', description: 'Lista los tokens activos de la familia. Solo aprobadores.', input_schema: { type: obj, properties: {}, required: [] } },
  { name: 'revoke_member_token', description: 'Revoca un token de un integrante. Solo aprobadores.', input_schema: { type: obj, properties: { tokenId: { type: 'string' } }, required: ['tokenId'] } },
];

// ── Tool handlers ───────────────────────────────────────────────

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  // Read
  get_household: (c) => getHousehold(c.familyId),
  get_pantry: (c) => getPantry(c.familyId),
  get_purchase_history: (c, a) => getPurchaseHistory(c.familyId, a as any),
  get_locked_products: (c) => getLockedProducts(c.familyId),
  get_store_connection_status: (c) => getStoreConnectionStatus(c.familyId),
  get_list: (c) => getList(c.familyId),
  whoami: (c) => Promise.resolve({ memberId: c.memberId, memberName: c.memberName, isApprover: c.isApprover, familyId: c.familyId }),
  get_activity: async (c, a) => {
    const since = a.since ? new Date(a.since as string) : new Date(Date.now() - 7 * 86400000);
    return prisma.familyActivity.findMany({ where: { familyId: c.familyId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 50 });
  },

  // Action (member+)
  check_allergens: (c, a) => {
    const pid = a.productNutritionId as string | undefined;
    const pname = a.productName as string | undefined;
    if (pid) return checkAllergensForFamily(c.familyId, pid);
    if (pname) return checkAllergensForFamily(c.familyId, pname);
    return Promise.resolve({ warning: 'Necesito productNutritionId o productName' });
  },
  compare_prices: (c, a) => comparePrices(c.familyId, a as any),
  open_list: (c, a) => openList(c.familyId, c.memberId, a as any),
  add_list_items: async (c, a) => {
    const list = await openList(c.familyId, c.memberId);
    return addListItems(c.familyId, list.id, (a as any).items, c.memberId);
  },
  update_list_item: (c, a) => updateListItem(c.familyId, a.itemId as string, a as any),
  remove_list_item: (c, a) => removeListItem(c.familyId, a.itemId as string),
  suggest_for_list: (c, a) => suggestForList(c.familyId, a.listId as string),
  ask_household: (c, a) => askHousehold(c.familyId, a.listId as string, a.question as string, c.memberId, a.toMemberIds as string[] | undefined),
  import_purchases: (c, a) => { approverOnly(c); return importPurchases(c.familyId, a as any); },

  // Approver-only
  propose_cart: (c, a) => proposeCart(c.familyId, a as any),
  approve_item: (c, a) => { approverOnly(c); return approveItem(c.familyId, a as any); },
  approve_cart: (c, a) => { approverOnly(c); return approveCart(c.familyId, a as any); },
  fill_cart: (c, a) => { approverOnly(c); return fillStoreCart(c.familyId, a.cartId as string); },
  get_delivery_windows: (c, a) => getStoreDeliveryWindows(c.familyId, a as any),
  connect_store: (c, a) => { approverOnly(c); return connectStoreForFamily(c.familyId, a as any); },
  cancel_cart: (c, a) => { approverOnly(c); return cancelCart(c.familyId, a.cartId as string, c.memberId, a.reason as string | undefined); },
  record_order: (c, a) => { approverOnly(c); return recordOrder(c.familyId, a as any, c.memberId); },
  mark_delivered: (c, a) => { approverOnly(c); return markDelivered(c.familyId, a.cartId as string, c.memberId, (a.adjustments as any) || undefined); },
  accept_substitution: (c, a) => { approverOnly(c); return saveSubstitutionPreference(c.familyId, a.original as string, a.substitute as string, a.accepted as boolean); },
  confirm_list: (c) => { approverOnly(c); return confirmList(c.familyId, c.memberId); },
  convert_list_to_cart: (c, a) => { approverOnly(c); return convertListToCart(c.familyId, a.store as 'jumbo' | 'lider' | 'unimarc' | 'tottus', c.memberId); },
  invite_member: async (c, a) => {
    approverOnly(c);
    const member = await prisma.familyMember.findFirst({ where: { id: a.memberId as string, familyId: c.familyId, isActive: true }, select: { id: true, name: true, role: true } });
    if (!member) throw new Error('No encontré ese integrante en la familia');
    const role = ((a.role as string) || 'member') as 'approver' | 'member' | 'viewer';
    if (role === 'approver') {
      const ok = await isFamilyApproverById(member.id, c.familyId);
      if (!ok) throw new Error(`${member.name} no es aprobador/a. Invítalo como member o viewer.`);
    }
    const code = await generateInviteCode(c.familyId, member.id, role, (a.label as string) || member.name);
    return { memberId: member.id, memberName: member.name, role, code, expiresIn: '72 horas' };
  },
  list_member_tokens: async (c) => {
    approverOnly(c);
    const tokens = await prisma.memberToken.findMany({ where: { familyId: c.familyId, revokedAt: null }, include: { member: { select: { name: true, role: true } } }, orderBy: { createdAt: 'desc' } });
    return tokens.map((t) => ({ id: t.id, memberId: t.memberId, memberName: t.member.name, tokenRole: t.role, label: t.label, lastUsedAt: t.lastUsedAt?.toISOString() ?? null }));
  },
  revoke_member_token: async (c, a) => {
    approverOnly(c);
    const token = await prisma.memberToken.findFirst({ where: { id: a.tokenId as string, familyId: c.familyId, revokedAt: null }, include: { member: { select: { name: true } } } });
    if (!token) throw new Error('Token no encontrado o ya revocado');
    await prisma.memberToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
    return { revoked: true, memberName: token.member.name };
  },
};

const TOOL_LABELS: Record<string, string> = {
  get_household: 'Revisando la familia...',
  get_pantry: 'Revisando la despensa...',
  get_purchase_history: 'Buscando en el historial...',
  get_locked_products: 'Revisando productos fijos...',
  compare_prices: 'Comparando precios en 4 tiendas...',
  check_allergens: 'Verificando alérgenos...',
  get_store_connection_status: 'Revisando tiendas...',
  open_list: 'Abriendo la lista...',
  add_list_items: 'Agregando a la lista...',
  get_list: 'Cargando la lista...',
  propose_cart: 'Armando el carro...',
  approve_item: 'Aprobando ítem...',
  approve_cart: 'Aprobando el carro...',
  fill_cart: 'Llenando el carro en la tienda...',
  get_delivery_windows: 'Consultando horarios de despacho...',
  connect_store: 'Conectando la tienda...',
  cancel_cart: 'Cancelando el carro...',
  record_order: 'Registrando el pedido...',
  mark_delivered: 'Marcando como entregado...',
  accept_substitution: 'Guardando preferencia...',
  import_purchases: 'Importando compras...',
  update_list_item: 'Actualizando ítem...',
  remove_list_item: 'Quitando de la lista...',
  suggest_for_list: 'Buscando sugerencias...',
  ask_household: 'Preguntando a la familia...',
  confirm_list: 'Confirmando la lista...',
  convert_list_to_cart: 'Convirtiendo lista en carro...',
  invite_member: 'Generando invitación...',
  list_member_tokens: 'Listando tokens...',
  revoke_member_token: 'Revocando token...',
  whoami: 'Verificando identidad...',
  get_activity: 'Cargando actividad...',
};

// ── Endpoint ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let membership;
  try {
    membership = await requireFamilyMembership();
  } catch {
    return Response.json({ error: 'No autenticado o sin familia' }, { status: 401 });
  }

  const ctx: ToolCtx = {
    familyId: membership.familyId,
    memberId: membership.memberId,
    memberName: membership.memberName,
    isApprover: membership.isApprover,
  };

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
        const toolsUsed: { tool: string; success: boolean }[] = [];

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: AVI_MCP_INSTRUCTIONS + `\n\nEstás hablando con ${membership.memberName} (${membership.isApprover ? 'aprobador/a' : 'miembro'}).`,
            messages: currentMessages,
            tools: TOOL_DEFS,
          });

          if (response.stop_reason === 'tool_use') {
            const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
            const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');

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
                  ? await handler(ctx, (tool.input || {}) as Record<string, unknown>)
                  : { error: `Herramienta ${tool.name} no disponible` };
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
