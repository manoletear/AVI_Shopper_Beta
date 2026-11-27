/**
 * Registra las dos compras Jumbo de la familia Aravena (fam-manu-001) usando el
 * mismo camino que el MCP: recordOrder(). Idempotente por orderRef.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/register-jumbo-orders.ts
 *
 * No paga ni hace checkout: solo deja constancia de lo ya comprado.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordOrder } from '../src/lib/mcp/tools';
import type { RecordOrderLineInput } from '../src/types/mcp';

const FAMILY_ID = 'fam-manu-001';
const DIR = join(process.cwd(), 'tmp-orders');

type RawLine = {
  name: string;
  qty: number;
  unitPrice: number | null;
  barcode?: string;
};

function toLine(raw: RawLine): RecordOrderLineInput {
  const isWeight = /granel/i.test(raw.name);
  return {
    name: raw.name,
    quantity: raw.qty,
    unit: isWeight ? 'kg' : 'un',
    unitPriceClp: raw.unitPrice ?? null,
    ...(raw.barcode ? { barcode: raw.barcode } : {}),
  };
}

async function main() {
  // ---- Pedido 23-nov ----
  const o1 = JSON.parse(readFileSync(join(DIR, 'v244113174jmch.json'), 'utf8'));
  const r1 = await recordOrder(FAMILY_ID, {
    store: 'jumbo',
    orderRef: 'v244113174jmch-01',
    placedAt: '2026-11-23T13:00:00.000Z',
    deliveredAt: '2026-11-23T16:02:00.000Z',
    total: 83051, // cobro inicial 82.900 + adicional 151
    subtotal: 78061, // productos cobrados tras promos
    deliveryFee: 4990,
    cartIds: ['cmwt56nw9003xjm0889ewd13o'],
    lines: (o1.lines as RawLine[]).map(toLine),
    note: 'Total cobrado 83.051 (82.900 + adicional 151 por peso del plátano). Boleta 3531782097.',
  });
  console.log('PEDIDO 23-nov:', JSON.stringify(r1, null, 2));

  // ---- Pedido 26-nov ----
  const o2 = JSON.parse(readFileSync(join(DIR, 'v244362591jmch.json'), 'utf8'));
  const confirmed = o2.linesConfirmedFromJumboUI as RawLine[];
  const likely = o2.linesLikelyFromApprovedCarts as RawLine[];
  const r2 = await recordOrder(FAMILY_ID, {
    store: 'jumbo',
    orderRef: 'v244362591jmch-01',
    placedAt: '2026-11-26T14:40:00.000Z',
    deliveredAt: '2026-11-26T16:05:00.000Z',
    total: 130310, // cobro inicial 129.710 + adicional 600
    subtotal: 125320, // productos cobrados (124.720 tras promos + 600)
    deliveryFee: 4990,
    cartIds: ['cmwwrvgry009nl408qkq57vax', 'cmwxgtujt0001l808eg4e6ffl'],
    lines: [...confirmed, ...likely].map(toLine),
    note:
      'Total cobrado 130.310 (129.710 + adicional 600). Jumbo no adjuntó boleta. 2× Vanish Oxi Action Polvo Rosa Recarga 850 g sin precio unitario conocido; el residual (unallocatedToReachCheckoutSubtotal 33.840) cubre esas recargas, diferencias vs precios AVI y el +600. Glutamato NO comprado, no incluido.',
  });
  console.log('PEDIDO 26-nov:', JSON.stringify(r2, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
