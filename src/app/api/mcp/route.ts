import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { authenticateMcpToken } from '@/lib/mcp/auth';
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
// fill_cart espera al worker de tiendas (navegador real): puede tardar minutos.
export const maxDuration = 300;

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await fn(), null, 2) }] };
  } catch (error) {
    // Solo errores propios llegan al cliente; el resto queda en el log.
    if (!(error instanceof McpToolError)) console.error('MCP tool error:', error);
    const message = error instanceof McpToolError ? error.message : 'Error interno de AVI';
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}

/** Un servidor por request y por familia: el familyId sale del token, nunca de los argumentos. */
function createServer(familyId: string) {
  const server = new McpServer(
    { name: 'avi-shopper', version: '1.0.0' },
    { instructions: AVI_MCP_INSTRUCTIONS },
  );

  server.registerTool(
    'get_household',
    { description: 'Integrantes activos, roles, alergias por integrante, dietas, mascotas y quién aprueba el carro.' },
    () => run(() => getHousehold(familyId)),
  );

  server.registerTool(
    'get_locked_products',
    { description: 'Productos fijos (marca y formato) que la familia repite en cada pedido. El aprobador los confirma al inicio.' },
    () => run(() => getLockedProducts(familyId)),
  );

  server.registerTool(
    'propose_cart',
    {
      description:
        'Crea un carro propuesto (estado "proposed") en Jumbo, Lider, Unimarc o Tottus. Revisa alérgenos por integrante y avisa. AVI propone, la familia decide; nunca paga ni hace checkout.',
      inputSchema: proposeCartShape,
    },
    (args) => run(() => proposeCart(familyId, args)),
  );

  server.registerTool(
    'check_allergens',
    {
      description:
        'Compara un producto de product_nutrition con las alergias de cada integrante. Advierte (contiene / puede contener) y marca requiresApproval; nunca bloquea.',
      inputSchema: checkAllergensShape,
    },
    (args) => run(() => checkAllergensForFamily(familyId, args.productNutritionId)),
  );

  server.registerTool(
    'approve_item',
    { description: 'Aprueba o rechaza un ítem del carro propuesto. Solo el aprobador de la familia.', inputSchema: approveItemShape },
    (args) => run(() => approveItem(familyId, args)),
  );

  server.registerTool(
    'approve_cart',
    {
      description: 'Aprueba el carro propuesto completo. Solo el aprobador. AVI no paga ni hace el pedido.',
      inputSchema: approveCartShape,
    },
    (args) => run(() => approveCart(familyId, args)),
  );

  server.registerTool(
    'get_pantry',
    { description: 'Despensa estimada: qué se está acabando primero, con calorías desde product_nutrition.' },
    () => run(() => getPantry(familyId)),
  );

  server.registerTool(
    'fill_cart',
    {
      description:
        'Llena el carro real en la tienda con los ítems APROBADOS de un carro aprobado (productos fijos). Si algo no hay, propone sustituto pendiente de aprobación y no lo agrega. Compara el carro de la tienda con lo aprobado. Se detiene en el carro lleno: NUNCA hace checkout ni paga. Si la tienda pide captcha o 2FA devuelve needs_user_action.',
      inputSchema: fillCartShape,
    },
    (args) => run(() => fillStoreCart(familyId, args.cartId)),
  );

  server.registerTool(
    'get_delivery_windows',
    {
      description:
        'Horarios de despacho de la tienda con la sesión de la familia (por defecto su dirección principal). Solo lee; no reserva ni paga.',
      inputSchema: deliveryWindowsShape,
    },
    (args) => run(() => getStoreDeliveryWindows(familyId, args)),
  );

  server.registerTool(
    'connect_store',
    {
      description:
        'Conecta la cuenta del supermercado de la familia. Las credenciales se usan una vez para obtener cookies de sesión; luego se descartan. Solo se guardan cookies cifradas (AES-256-GCM). Si hay captcha o 2FA devuelve needs_user_action. Nunca guarda ni loguea email/password.',
      inputSchema: {
        store: z.enum(['jumbo', 'lider', 'unimarc', 'tottus']),
        email: z.string().email(),
        password: z.string().min(1),
      },
    },
    (args) => run(() => connectStoreForFamily(familyId, args)),
  );

  server.registerTool(
    'get_store_connection_status',
    { description: 'Estado de conexión de cada supermercado: si está conectado, activo, expirado o necesita acción del usuario.' },
    () => run(() => getStoreConnectionStatus(familyId)),
  );

  server.registerTool(
    'get_purchase_history',
    {
      description:
        'Historial de compras de la familia. Muestra qué compran, en qué tienda, a qué precio, y si ya se aplicó al perfil de consumo. Úsalo junto con get_pantry antes de proponer un carro.',
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
    'import_purchases',
    {
      description:
        'Importa historial de compras desde una fuente externa (Uber Eats, Jumbo, Lider, Cornershop, Rappi, etc.). Grok extrae los datos usando las credenciales del vault del usuario y los pasa normalizados a AVI. AVI nunca accede a credenciales — solo recibe los productos. Máximo 2.000 por llamada. Después de importar, get_pantry refleja los nuevos datos automáticamente.',
      inputSchema: {
        source: z.enum(['ubereats', 'jumbo', 'lider', 'unimarc', 'tottus', 'cornershop', 'rappi', 'pedidosya', 'manual']),
        buyer: z.string().optional().describe('Nombre del comprador (ej: "Claudia"). Si no se indica, se asigna al master.'),
        purchases: z.array(z.object({
          productName: z.string(),
          brand: z.string().optional(),
          category: z.string().optional(),
          storeSlug: z.string().optional(),
          storeName: z.string().optional(),
          price: z.number().optional().describe('Precio unitario en CLP enteros'),
          quantity: z.number().optional().default(1),
          unit: z.string().optional().describe('g, kg, l, ml, un'),
          baseAmount: z.number().optional(),
          baseUnit: z.string().optional(),
          groupKey: z.string().optional().describe('Producto canónico: yoghurt, pan_molde, leche_entera, etc.'),
          orderRef: z.string().optional().describe('ID de la orden para agrupar items de una misma compra'),
          purchasedAt: z.string().describe('Fecha ISO de la compra'),
        })).min(1).max(2000),
      },
    },
    (args) => run(() => importPurchases(familyId, args)),
  );

  server.registerTool(
    'compare_prices',
    {
      description:
        'Compara precios de una lista de productos en Jumbo, Lider, Unimarc y Tottus. Usa precios del historial de la familia + catálogo. Incluye delivery estimado. Retorna la tienda más barata y si conviene dividir entre dos tiendas (ahorro neto > costo del delivery extra). Úsalo ANTES de propose_cart cuando el usuario quiere ahorrar.',
      inputSchema: {
        products: z.array(z.object({
          groupKey: z.string().describe('Producto canónico: yoghurt, leche_entera, pan_molde, etc.'),
          quantity: z.number().positive().describe('Cantidad a comprar'),
        })).min(1).max(50),
      },
    },
    (args) => run(() => comparePrices(familyId, args)),
  );

  return server;
}

function unauthorized() {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32001, message: 'Token Bearer inválido o ausente' }, id: null },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}

// Sin sesiones en memoria: en Vercel cada request puede caer en otra instancia.
export async function POST(request: Request) {
  const familyId = await authenticateMcpToken(request.headers.get('authorization'));
  if (!familyId) return unauthorized();

  const server = createServer(familyId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // La respuesta JSON ya está armada; cerrar libera el servidor de este request.
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
