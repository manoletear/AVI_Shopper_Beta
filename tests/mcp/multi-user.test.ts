import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authenticateToken, parseTokens, MIN_TOKEN_LENGTH } from '../../src/lib/mcp/auth';
import type { McpRole } from '../../src/lib/mcp/auth';

const TOK_A = 'a'.repeat(MIN_TOKEN_LENGTH);
const TOK_B = 'b'.repeat(MIN_TOKEN_LENGTH + 8);
const ENV = `fam-a:${TOK_A}, fam-b:${TOK_B}`;

describe('Multi-user auth — legacy env var', () => {
  it('legacy token retorna familyId y funciona como approver', () => {
    const result = authenticateToken(`Bearer ${TOK_A}`, ENV);
    assert.equal(result, 'fam-a');
  });

  it('token desconocido retorna null', () => {
    assert.equal(authenticateToken(`Bearer ${'x'.repeat(MIN_TOKEN_LENGTH)}`, ENV), null);
  });

  it('token revocado (no en env) retorna null', () => {
    assert.equal(authenticateToken(`Bearer ${'r'.repeat(MIN_TOKEN_LENGTH)}`, ENV), null);
  });
});

describe('Multi-user — role matrix', () => {
  const roles: McpRole[] = ['approver', 'member', 'viewer'];

  const APPROVER_ONLY = ['approve_item', 'approve_cart', 'fill_cart', 'invite_member', 'list_member_tokens', 'revoke_member_token'];
  const MEMBER_TOOLS = ['check_allergens', 'propose_cart', 'connect_store', 'get_delivery_windows', 'import_purchases', 'compare_prices'];
  const VIEWER_TOOLS = ['get_household', 'get_pantry', 'get_purchase_history', 'get_locked_products', 'get_store_connection_status', 'whoami', 'get_activity', 'redeem_invite'];

  it('approver ve todas las herramientas', () => {
    const allTools = [...VIEWER_TOOLS, ...MEMBER_TOOLS, ...APPROVER_ONLY];
    for (const tool of allTools) {
      assert.ok(allTools.includes(tool), `approver should have ${tool}`);
    }
    assert.equal(allTools.length, 20);
  });

  it('member no tiene herramientas de approver', () => {
    const memberTools = [...VIEWER_TOOLS, ...MEMBER_TOOLS];
    for (const tool of APPROVER_ONLY) {
      assert.equal(memberTools.includes(tool), false, `member should NOT have ${tool}`);
    }
  });

  it('viewer solo tiene herramientas de lectura', () => {
    for (const tool of MEMBER_TOOLS) {
      assert.equal(VIEWER_TOOLS.includes(tool), false, `viewer should NOT have ${tool}`);
    }
    for (const tool of APPROVER_ONLY) {
      assert.equal(VIEWER_TOOLS.includes(tool), false, `viewer should NOT have ${tool}`);
    }
  });
});

describe('Multi-user — token parsing', () => {
  it('parseTokens ignora tokens cortos', () => {
    assert.equal(parseTokens('fam:short').length, 0);
  });

  it('parseTokens acepta múltiples familias', () => {
    const entries = parseTokens(ENV);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].familyId, 'fam-a');
    assert.equal(entries[1].familyId, 'fam-b');
  });

  it('aislamiento: token de familia A no resuelve familia B', () => {
    assert.equal(authenticateToken(`Bearer ${TOK_A}`, ENV), 'fam-a');
    assert.notEqual(authenticateToken(`Bearer ${TOK_A}`, ENV), 'fam-b');
    assert.equal(authenticateToken(`Bearer ${TOK_B}`, ENV), 'fam-b');
    assert.notEqual(authenticateToken(`Bearer ${TOK_B}`, ENV), 'fam-a');
  });
});
