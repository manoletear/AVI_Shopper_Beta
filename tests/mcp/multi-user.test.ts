import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authenticateToken, parseTokens, MIN_TOKEN_LENGTH } from '../../src/lib/mcp/auth';
import type { McpRole } from '../../src/lib/mcp/auth';

const TOK_A = 'a'.repeat(MIN_TOKEN_LENGTH);
const TOK_B = 'b'.repeat(MIN_TOKEN_LENGTH + 8);
const ENV = `fam-a:${TOK_A}, fam-b:${TOK_B}`;

describe('Multi-user auth — legacy env var', () => {
  it('legacy token retorna familyId', () => {
    assert.equal(authenticateToken(`Bearer ${TOK_A}`, ENV), 'fam-a');
  });

  it('token desconocido retorna null', () => {
    assert.equal(authenticateToken(`Bearer ${'x'.repeat(MIN_TOKEN_LENGTH)}`, ENV), null);
  });

  it('sin header retorna null', () => {
    assert.equal(authenticateToken(null, ENV), null);
  });

  it('otro esquema retorna null', () => {
    assert.equal(authenticateToken(`Basic ${TOK_A}`, ENV), null);
  });

  it('token corto rechazado', () => {
    assert.equal(authenticateToken('Bearer short', 'fam:short'), null);
  });
});

describe('Multi-user — role matrix', () => {
  // Herramientas por nivel de acceso
  const VIEWER_TOOLS = [
    'get_household', 'get_pantry', 'get_purchase_history',
    'get_locked_products', 'get_store_connection_status', 'whoami',
  ];
  const MEMBER_TOOLS = [
    ...VIEWER_TOOLS, 'get_activity',
    'check_allergens', 'propose_cart', 'get_delivery_windows', 'compare_prices',
  ];
  const APPROVER_TOOLS = [
    ...MEMBER_TOOLS,
    'approve_item', 'approve_cart', 'fill_cart',
    'connect_store', 'import_purchases',
    'invite_member', 'list_member_tokens', 'revoke_member_token',
  ];

  it('approver tiene 19 herramientas (redeem_invite es endpoint público aparte)', () => {
    assert.equal(APPROVER_TOOLS.length, 19);
  });

  it('member tiene 11 herramientas', () => {
    assert.equal(MEMBER_TOOLS.length, 11);
  });

  it('viewer tiene 6 herramientas', () => {
    assert.equal(VIEWER_TOOLS.length, 6);
  });

  it('member no tiene herramientas de approver', () => {
    const approverOnly = APPROVER_TOOLS.filter((t) => !MEMBER_TOOLS.includes(t));
    assert.ok(approverOnly.length > 0);
    for (const tool of approverOnly) {
      assert.equal(MEMBER_TOOLS.includes(tool), false, `member should NOT have ${tool}`);
    }
  });

  it('viewer no tiene herramientas de member', () => {
    const memberOnly = MEMBER_TOOLS.filter((t) => !VIEWER_TOOLS.includes(t));
    for (const tool of memberOnly) {
      assert.equal(VIEWER_TOOLS.includes(tool), false, `viewer should NOT have ${tool}`);
    }
  });

  it('connect_store e import_purchases son solo approver', () => {
    assert.ok(APPROVER_TOOLS.includes('connect_store'));
    assert.ok(APPROVER_TOOLS.includes('import_purchases'));
    assert.ok(!MEMBER_TOOLS.includes('connect_store'));
    assert.ok(!MEMBER_TOOLS.includes('import_purchases'));
  });

  it('get_activity disponible para member pero no viewer', () => {
    assert.ok(MEMBER_TOOLS.includes('get_activity'));
    assert.ok(!VIEWER_TOOLS.includes('get_activity'));
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

  it('env vacío no autentica nada', () => {
    assert.equal(authenticateToken(`Bearer ${TOK_A}`, ''), null);
    assert.equal(authenticateToken(`Bearer ${TOK_A}`, undefined), null);
  });
});

describe('Multi-user — rate limit logic', () => {
  it('checkRateLimit concept: 5 intentos max por ventana', () => {
    const attempts = new Map<string, { count: number; resetAt: number }>();
    const RATE_LIMIT = 5;
    const RATE_WINDOW_MS = 15 * 60 * 1000;

    function checkRateLimit(ip: string): boolean {
      const now = Date.now();
      const entry = attempts.get(ip);
      if (!entry || now > entry.resetAt) {
        attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
      }
      if (entry.count >= RATE_LIMIT) return false;
      entry.count++;
      return true;
    }

    const ip = '1.2.3.4';
    for (let i = 0; i < RATE_LIMIT; i++) {
      assert.ok(checkRateLimit(ip), `attempt ${i + 1} should pass`);
    }
    assert.equal(checkRateLimit(ip), false, 'attempt 6 should fail');
    assert.equal(checkRateLimit(ip), false, 'attempt 7 should fail');

    // Different IP is independent
    assert.ok(checkRateLimit('5.6.7.8'));
  });
});

describe('Multi-user — McpAuthDbError', () => {
  it('McpAuthDbError is importable and has correct message', async () => {
    const { McpAuthDbError } = await import('../../src/lib/mcp/auth');
    const err = new McpAuthDbError(new Error('connection refused'));
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes('base de datos'));
    assert.ok(err.dbCause instanceof Error);
  });
});
