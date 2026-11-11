import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  authenticateMcpToken,
  generateInviteCode,
  McpAuthDbError,
  type McpIdentity,
  type McpRole,
} from '@/lib/mcp/auth';
import { isFamilyApproverById } from '@/lib/family/approver';
import { AVI_MCP_INSTRUCTIONS } from '@/lib/mcp/instructions';
import {
  approveCart,
  approveItem,
  checkAllergensForFamily,
  fillStoreCart,
  getStoreDeliveryWindows,
  connectStoreForFamily,
  getStoreConnectionStatus,
  getHousehold,
  getLockedProducts,
  getPantry,
  getPurchaseHistory,
  importPurchases,
  comparePrices,
  McpToolError,
  proposeCart,
} from '@/lib/mcp/tools';
import {
  approveCartShape,
  approveItemShape,
  checkAllergensShape,
  deliveryWindowsShape,
  fillCartShape,
  proposeCartShape,
} from '@/types/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await fn(), null, 2) }] };
  } catch (error) {
    if (!(error instanceof McpToolError)) console.error('MCP tool error:', error);
    const message = error instanceof McpToolError ? error.message : 'Error interno de AVI';
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}

function requireRole(identity: McpIdentity, ...allowed: McpRole[]) {
  if (!allowed.includes(identity.role)) {
    throw new McpToolError(
      identity.role === 'viewer'
        ? 'Solo puedes ver, no modificar. Pide al aprobador que te suba de rol.'
        : 'Solo los aprobadores de la familia pueden hacer esto.',
    );
  }
}

async function requireFamilyApprover(identity: McpIdentity, familyId: string) {
  requireRole(identity, 'approver');
  if (identity.memberId) {
    const ok = await isFamilyApproverById(identity.memberId, familyId);
    if (!ok) throw new McpToolError('Tu token dice approver, pero no eres aprobador de esta familia.');
  }
}

async function logActivity(familyId: string, memberId: string | null, action: string, entityType?: string, entityId?: string, payload?: object) {
  prisma.familyActivity.create({
    data: { familyId, memberId, action, entityType, entityId, payload: payload ?? {} },
  }).catch((e) => console.warn('[activity]', e instanceof Error ? e.message : e));
}

async function notifyOtherApprovers(familyId: string, excludeMemberId: string | null, subject: string, text: string) {
  try {
    const { Resend } = await import('resend');
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!key || !from) return;
    const resend = new Resend(key);
    const members = await prisma.familyMember.findMany({
      where: { familyId, isActive: true },
      include: { user: { select: { email: true } } },
    });
    const settings = await prisma.familySettings.findUnique({ where: { familyId } });
    for (const m of members) {
      if (m.id === excludeMemberId || !m.user?.email) continue;
      const { isApprover } = await import('@/lib/family/approver');
      if (!isApprover(m, settings)) continue;
      await resend.emails.send({ from, to: m.user.email, subject, text });
    }
  } catch (e) {
    console.warn('[notify-approvers]', e instanceof Error ? e.message : e);
  }
}

function createServer(familyId: string, identity: McpIdentity) {
  const server = new McpServer(
    { name: 'avi-shopper', version: '2.1.0' },
    { instructions: AVI_MCP_INSTRUCTIONS },
  );

  // ── Lectura: approver + member + viewer ──

  server.registerTool(
    'get_household',
    { description: 'Integrantes activos, roles, alergias por integrante, dietas, mascotas y quién aprueba el carro.' },
    () => run(() => getHousehold(familyId)),
  );

  server.registerTool(
    'get_locked_products',
    { description: 'Productos fijos (marca y formato) que la familia repite en cada pedido.' },
    () => run(() => getLockedProducts(familyId)),
  );

  server.registerTool(
    'get_pantry',
    { description: 'Despensa inteligente: semáforo rojo/amarillo/verde, stock estimado, días restantes, consumo por contexto (colación, cotidiano, asado).' },
    () => run(() => getPantry(familyId)),
  );

  server.registerTool(
    'get_store_connection_status',
    { description: 'Estado de conexión de cada supermercado.' },
    () => run(() => getStoreConnectionStatus(familyId)),
  );

  server.registerTool(
    'get_purchase_history',
    {
      description: 'Historial de compras de la familia.',
      inputSchema: {
        limit: z.number().int().positive().max(200).optional(),
        storeSlug: z.enum(['jumbo', 'lider', 'unimarc', 'tottus']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      },
    },
    (args) => run(() => getPurchaseHistory(familyId, args)),
  );

  server.registerTool(
    'whoami',
    { description: 'Muestra quién eres en esta familia: nombre, rol y si puedes aprobar carros.' },
    () => run(async () => ({
      familyId,
      memberId: identity.memberId,
      memberName: identity.memberName,
      role: identity.role,
      isApprover: identity.role === 'approver',
    })),
  );

  server.registerTool(
    'get_activity',
    {
      description: 'Log de actividad: quién propuso, aprobó o importó qué. Para coordinar entre integrantes.',
      inputSchema: {
        since: z.string().optional().describe('Fecha ISO desde la que buscar. Por defecto últimas 24h.'),
      },
    },
    (args) => run(async () => {
      requireRole(identity, 'approver', 'member');
      const since = args.since ? new Date(args.since) : new Date(Date.now() - 86400000);
      return prisma.familyActivity.findMany({
        where: { familyId, createdAt: { gte: since } },
        include: { member: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),
  );

  // ── Lectura + escritura: approver + member ──

  if (identity.role !== 'viewer') {
    server.registerTool(
      'check_allergens',
      {
        description: 'Compara un producto con las alergias de cada integrante.',
        inputSchema: checkAllergensShape,
      },
      (args) => run(() => checkAllergensForFamily(familyId, args.productNutritionId)),
    );

    server.registerTool(
      'propose_cart',
      {
        description: 'Crea un carro propuesto. AVI propone, la familia decide; nunca paga ni hace checkout.',
        inputSchema: proposeCartShape,
      },
      (args) => run(async () => {
        const result = await proposeCart(familyId, args);
        await logActivity(familyId, identity.memberId, 'proposed_cart', 'proposed_cart', result.cartId, {
          store: result.store, subtotal: result.subtotal, items: result.items.length,
        });
        if (identity.memberId) {
          await prisma.proposedCart.update({
            where: { id: result.cartId },
            data: { proposedByMemberId: identity.memberId },
          }).catch(() => {});
        }
        notifyOtherApprovers(
          familyId, identity.memberId,
          `🛒 Nuevo carro propuesto por ${identity.memberName || 'AVI'} — $${result.subtotal.toLocaleString('es-CL')}`,
          `${identity.memberName || 'Alguien'} propuso un carro en ${result.store} por $${result.subtotal.toLocaleString('es-CL')}.\n\nRevísalo y apruébalo: https://avi-shopper-beta.vercel.app/carro/${result.cartId}\n\nAVI propone, la familia decide.`,
        );
        return result;
      }),
    );

    server.registerTool(
      'get_delivery_windows',
      {
        description: 'Horarios de despacho de la tienda.',
        inputSchema: deliveryWindowsShape,
      },
      (args) => run(() => getStoreDeliveryWindows(familyId, args)),
    );

    server.registerTool(
      'compare_prices',
      {
        description: 'Compara precios en Jumbo, Lider, Unimarc y Tottus. Incluye delivery. Sugiere la tienda más barata o dividir entre dos.',
        inputSchema: {
          products: z.array(z.object({
            groupKey: z.string(),
            quantity: z.number().positive(),
          })).min(1).max(50),
        },
      },
      (args) => run(() => comparePrices(familyId, args)),
    );
  }

  // ── Solo aprobadores ──

  if (identity.role === 'approver') {
    server.registerTool(
      'approve_item',
      {
        description: 'Aprueba o rechaza un ítem del carro propuesto. Solo aprobadores.',
        inputSchema: approveItemShape,
      },
      (args) => run(async () => {
        await requireFamilyApprover(identity, familyId);
        const result = await approveItem(familyId, args);
        if (identity.memberId) {
          await prisma.proposedCartItem.updateMany({
            where: { id: args.itemId },
            data: { approvedByMemberId: identity.memberId, approvedAt: new Date() },
          }).catch(() => {});
        }
        await logActivity(familyId, identity.memberId, 'approved_item', 'proposed_cart_item', args.itemId, {
          approved: args.approved,
        });
        return result;
      }),
    );

    server.registerTool(
      'approve_cart',
      {
        description: 'Aprueba el carro propuesto completo. Solo aprobadores. AVI no paga.',
        inputSchema: approveCartShape,
      },
      (args) => run(async () => {
        await requireFamilyApprover(identity, familyId);
        const result = await approveCart(familyId, args);
        if (identity.memberId) {
          await prisma.proposedCart.update({
            where: { id: args.cartId },
            data: { approvedByMemberId: identity.memberId, approvedAt: new Date() },
          }).catch(() => {});
        }
        await logActivity(familyId, identity.memberId, 'approved_cart', 'proposed_cart', args.cartId);
        notifyOtherApprovers(
          familyId, identity.memberId,
          `✅ Carro aprobado por ${identity.memberName || 'un aprobador'}`,
          `El carro fue aprobado. La familia puede revisar y pagar.\n\nhttps://avi-shopper-beta.vercel.app/carro/${args.cartId}`,
        );
        return result;
      }),
    );

    server.registerTool(
      'fill_cart',
      {
        description: 'Llena el carro real en la tienda. Solo aprobadores. NUNCA hace checkout.',
        inputSchema: fillCartShape,
      },
      (args) => run(async () => {
        await requireFamilyApprover(identity, familyId);
        const result = await fillStoreCart(familyId, args.cartId);
        await logActivity(familyId, identity.memberId, 'filled_cart', 'proposed_cart', args.cartId);
        return result;
      }),
    );

    server.registerTool(
      'connect_store',
      {
        description: 'Conecta la cuenta del supermercado de la familia. Solo aprobadores.',
        inputSchema: {
          store: z.enum(['jumbo', 'lider', 'unimarc', 'tottus']),
          email: z.string().email(),
          password: z.string().min(1),
        },
      },
      (args) => run(() => connectStoreForFamily(familyId, args)),
    );

    server.registerTool(
      'import_purchases',
      {
        description: 'Importa historial de compras desde una fuente externa. Solo aprobadores.',
        inputSchema: {
          source: z.enum(['ubereats', 'jumbo', 'lider', 'unimarc', 'tottus', 'cornershop', 'rappi', 'pedidosya', 'manual']),
          buyer: z.string().optional(),
          purchases: z.array(z.object({
            productName: z.string(),
            brand: z.string().optional(),
            category: z.string().optional(),
            storeSlug: z.string().optional(),
            storeName: z.string().optional(),
            price: z.number().optional(),
            quantity: z.number().optional().default(1),
            unit: z.string().optional(),
            baseAmount: z.number().optional(),
            baseUnit: z.string().optional(),
            groupKey: z.string().optional(),
            orderRef: z.string().optional(),
            purchasedAt: z.string(),
          })).min(1).max(2000),
        },
      },
      (args) => run(async () => {
        const result = await importPurchases(familyId, args);
        await logActivity(familyId, identity.memberId, 'imported_purchases', 'purchase_history', undefined, {
          source: args.source, count: result.imported,
        });
        return result;
      }),
    );

    server.registerTool(
      'invite_member',
      {
        description: 'Invita a un integrante a conectar su propio bot. Genera un código de un solo uso (72h). Solo aprobadores.',
        inputSchema: {
          memberId: z.string().min(1).describe('ID del integrante (de get_household)'),
          role: z.enum(['approver', 'member', 'viewer']).default('member'),
          label: z.string().optional(),
        },
      },
      (args) => run(async () => {
        const member = await prisma.familyMember.findFirst({
          where: { id: args.memberId, familyId, isActive: true },
          select: { id: true, name: true, role: true },
        });
        if (!member) throw new McpToolError('No encontré ese integrante en la familia');
        // Si pide rol 'approver', verificar que el invitado es realmente aprobador
        if (args.role === 'approver') {
          const ok = await isFamilyApproverById(member.id, familyId);
          if (!ok) throw new McpToolError(`${member.name} no es aprobador/a de esta familia. Invítalo como member o viewer.`);
        }
        const label = args.label || member.name;
        const code = await generateInviteCode(familyId, member.id, args.role, label);
        await logActivity(familyId, identity.memberId, 'invited_member', 'family_member', member.id, {
          role: args.role, memberName: member.name,
        });
        return {
          memberId: member.id,
          memberName: member.name,
          role: args.role,
          code,
          expiresIn: '72 horas',
          instructions: `Pásale esto a ${member.name}:\n\n"Conecta AVI en tu asistente:\n  1. Llama a POST https://avi-shopper-beta.vercel.app/api/mcp/redeem con { \"code\": \"${code}\" }\n  2. Guarda el token que te devuelve — no se puede recuperar.\n  3. Agrega el conector MCP con URL: https://avi-shopper-beta.vercel.app/api/mcp y ese token como Bearer."`,
        };
      }),
    );

    server.registerTool(
      'list_member_tokens',
      { description: 'Lista los tokens activos de la familia. Solo aprobadores.' },
      () => run(async () => {
        const tokens = await prisma.memberToken.findMany({
          where: { familyId, revokedAt: null },
          include: { member: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return tokens.map((t) => ({
          id: t.id,
          memberId: t.memberId,
          memberName: t.member.name,
          memberRole: t.member.role,
          tokenRole: t.role,
          label: t.label,
          createdAt: t.createdAt.toISOString(),
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        }));
      }),
    );

    server.registerTool(
      'revoke_member_token',
      {
        description: 'Revoca un token de un integrante. Solo aprobadores.',
        inputSchema: { tokenId: z.string().min(1) },
      },
      (args) => run(async () => {
        const token = await prisma.memberToken.findFirst({
          where: { id: args.tokenId, familyId, revokedAt: null },
          include: { member: { select: { name: true } } },
        });
        if (!token) throw new McpToolError('Token no encontrado o ya revocado');
        await prisma.memberToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
        await logActivity(familyId, identity.memberId, 'revoked_token', 'member_token', token.id, {
          memberName: token.member.name,
        });
        return { revoked: true, memberName: token.member.name };
      }),
    );
  }

  return server;
}

function unauthorized() {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32001, message: 'Token Bearer inválido o ausente' }, id: null },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}

function serviceUnavailable() {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32003, message: 'Servicio temporalmente no disponible' }, id: null },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  let identity: McpIdentity | null;
  try {
    identity = await authenticateMcpToken(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof McpAuthDbError) {
      console.error('[mcp] DB error en autenticación, respondiendo 503:', error.dbCause);
      return serviceUnavailable();
    }
    throw error;
  }
  if (!identity) return unauthorized();

  const server = createServer(identity.familyId, identity);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void transport.close();
    void server.close();
  }
}

function methodNotAllowed() {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Método no permitido (MCP sin sesión)' }, id: null },
    { status: 405, headers: { Allow: 'POST' } },
  );
}

export async function GET() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
