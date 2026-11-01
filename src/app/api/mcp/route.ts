import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateToken } from '@/lib/mcp/auth';
import {
  approveCart,
  approveItem,
  checkAllergensForFamily,
  getHousehold,
  getLockedProducts,
  getPantry,
  McpToolError,
  proposeCart,
} from '@/lib/mcp/tools';
import { approveCartShape, approveItemShape, checkAllergensShape, proposeCartShape } from '@/types/mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const server = new McpServer({ name: 'avi-shopper', version: '1.0.0' });

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
  const familyId = authenticateToken(request.headers.get('authorization'));
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
