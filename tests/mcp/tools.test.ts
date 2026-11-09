import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authenticateToken, MIN_TOKEN_LENGTH, parseTokens } from '../../src/lib/mcp/auth';
import { isApprover, parseMemberAllergies, payableFor } from '../../src/lib/mcp/tools';
import { approveCartShape, proposeCartSchema } from '../../src/types/mcp';
import { z } from 'zod';

const TOK_A = 'a'.repeat(MIN_TOKEN_LENGTH);
const TOK_B = 'b'.repeat(MIN_TOKEN_LENGTH + 8);
const ENV = `fam-a:${TOK_A}, fam-b:${TOK_B}`;

describe('MCP auth', () => {
  it('rechaza sin header o con otro esquema', () => {
    assert.equal(authenticateToken(null, ENV), null);
    assert.equal(authenticateToken(`Basic ${TOK_A}`, ENV), null);
    assert.equal(authenticateToken('Bearer', ENV), null);
  });

  it('devuelve la familia del token', () => {
    assert.equal(authenticateToken(`Bearer ${TOK_A}`, ENV), 'fam-a');
    assert.equal(authenticateToken(`bearer ${TOK_B}`, ENV), 'fam-b');
  });

  it('rechaza tokens desconocidos, prefijos y env vacío', () => {
    assert.equal(authenticateToken(`Bearer ${TOK_A}x`, ENV), null);
    assert.equal(authenticateToken(`Bearer ${TOK_A.slice(1)}`, ENV), null);
    assert.equal(authenticateToken(`Bearer ${TOK_A}`, ''), null);
    assert.equal(authenticateToken(`Bearer ${TOK_A}`, undefined), null);
  });

  it('ignora tokens cortos y entradas mal formadas', () => {
    assert.equal(parseTokens('fam:short,:nofamily,sinseparador').length, 0);
    assert.equal(authenticateToken('Bearer short', 'fam:short'), null);
  });

  it('acepta ":" dentro del token', () => {
    const token = `x:${'z'.repeat(MIN_TOKEN_LENGTH)}`;
    assert.equal(authenticateToken(`Bearer ${token}`, `fam-c:${token}`), 'fam-c');
  });
});

describe('MCP helpers', () => {
  it('lee alergias guardadas como JSON', () => {
    assert.deepEqual(parseMemberAllergies('["maní","mariscos"]'), ['maní', 'mariscos']);
    assert.deepEqual(parseMemberAllergies('no-json'), []);
    assert.deepEqual(parseMemberAllergies(null), []);
  });

  it('el aprobador elegido en el onboarding manda sobre el rol', () => {
    const claudia = { id: 'm1', name: 'Claudia', role: 'adult' };
    const manu = { id: 'm2', name: 'Manuel', role: 'master' };
    const stepState = JSON.stringify({ answers: { approver: { memberName: 'Claudia', memberId: 'm1' } } });
    assert.equal(isApprover(claudia, { approverRole: 'master', stepState }), true);
    assert.equal(isApprover(manu, { approverRole: 'master', stepState }), false);
  });

  it('sin elección, aprueba el rol approverRole (master por defecto)', () => {
    const manu = { id: 'm2', name: 'Manuel', role: 'master' };
    const yuli = { id: 'm3', name: 'Yuli', role: 'adult' };
    assert.equal(isApprover(manu, null), true);
    assert.equal(isApprover(yuli, null), false);
    assert.equal(isApprover(yuli, { approverRole: 'adult', stepState: '{}' }), true);
  });

  it('calcula el pagable en CLP', () => {
    assert.equal(payableFor(4, 1190), 4760);
    assert.equal(payableFor(0.5, 2990), 1495);
    assert.equal(payableFor(2, undefined), 0);
  });
});

describe('MCP schemas', () => {
  it('propose_cart acepta solo las 4 tiendas y no recibe familyId', () => {
    const ok = proposeCartSchema.parse({ store: 'jumbo', items: [{ name: 'Leche', quantity: 4 }] });
    assert.equal(ok.items[0].unit, 'un');
    assert.equal('familyId' in ok, false);
    assert.equal(proposeCartSchema.safeParse({ store: 'santa-isabel', items: [{ name: 'x', quantity: 1 }] }).success, false);
    assert.equal(proposeCartSchema.safeParse({ store: 'lider', items: [] }).success, false);
    assert.equal(proposeCartSchema.safeParse({ store: 'lider', items: [{ name: 'x', quantity: -1 }] }).success, false);
  });

  it('approve_cart deja approvePending en false por defecto', () => {
    const parsed = z.object(approveCartShape).parse({ cartId: 'c1', approverMemberId: 'm1' });
    assert.equal(parsed.approvePending, false);
  });
});

describe('/api/mcp', () => {
  const body = (method: string, params: object = {}) =>
    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const headers = (token?: string) => ({
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  });

  it('401 sin token y lista las herramientas con token', async () => {
    process.env.AVI_MCP_TOKENS = ENV;
    const { POST, GET } = await import('../../src/app/api/mcp/route');
    const denied = await POST(new Request('http://x/api/mcp', { method: 'POST', headers: headers(), body: body('tools/list') }));
    assert.equal(denied.status, 401);
    assert.equal((await GET()).status, 405);

    const init = await POST(
      new Request('http://x/api/mcp', {
        method: 'POST',
        headers: headers(TOK_A),
        body: body('initialize', {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        }),
      }),
    );
    assert.equal(init.status, 200);

    const list = await POST(
      new Request('http://x/api/mcp', {
        method: 'POST',
        headers: { ...headers(TOK_A), 'mcp-protocol-version': '2025-06-18' },
        body: body('tools/list'),
      }),
    );
    assert.equal(list.status, 200);
    const json = (await list.json()) as { result: { tools: { name: string; inputSchema: { properties?: object } }[] } };
    const names = json.result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      'approve_cart', 'approve_item', 'check_allergens', 'connect_store', 'fill_cart', 'get_delivery_windows', 'get_household', 'get_locked_products', 'get_pantry', 'get_purchase_history', 'get_store_connection_status', 'import_purchases', 'propose_cart',
    ]);
    for (const tool of json.result.tools) {
      assert.equal(Object.keys(tool.inputSchema.properties ?? {}).includes('familyId'), false, tool.name);
    }
  });
});
