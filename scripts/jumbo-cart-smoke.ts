/**
 * Prueba real contra Jumbo: busca, agrega al carrito de invitado, lee el total y borra el carrito.
 * No abre el checkout ni paga.
 *
 *   npx tsx scripts/jumbo-cart-smoke.ts
 */
import { fillJumboCart } from '../src/services/cart-agent/jumbo';
import { JUMBO_CART_API, JUMBO_DEFAULT_SELLER, JUMBO_PUBLIC_CART_KEY } from '../src/services/cart-agent/types';
import { createJumboGuestSession } from '../src/services/cart-agent/session';

async function main() {
  const filled = await fillJumboCart([
    { productName: 'Leche Colun Entera 1 L', quantity: 1 },
    { productName: 'Arroz grado 1 1 kg', quantity: 1 },
  ]);

  console.log(JSON.stringify({
    itemsAdded: filled.itemsAdded,
    itemsFailed: filled.itemsFailed,
    totalEstimated: filled.totalEstimated,
    cartId: filled.cartId,
    lines: filled.items.map((line) => ({
      query: line.query,
      matchedName: line.matchedName,
      sku: line.sku,
      quantity: line.quantity,
      price: line.price,
      added: line.added,
      reason: line.reason,
    })),
  }, null, 2));

  const { guestHeader } = createJumboGuestSession(filled.sessionId);
  const base = (process.env.JUMBO_CART_API_URL || JUMBO_CART_API).replace(/\/$/, '');
  const key = process.env.JUMBO_CART_API_KEY || JUMBO_PUBLIC_CART_KEY;
  const headers = {
    apikey: key,
    'x-provider-guest-id': guestHeader,
    'x-client-platform': 'web',
    'user-agent': 'Mozilla/5.0',
  };
  const deleted = await fetch(`${base}/cart/items`, { method: 'DELETE', headers });
  const after = await fetch(`${base}/cart?store=${encodeURIComponent(process.env.JUMBO_SELLER_ID || JUMBO_DEFAULT_SELLER)}`, { headers });
  const cart = await after.json() as { itemsQuantity?: number };
  console.log(JSON.stringify({
    cleaned: deleted.status,
    itemsLeft: cart.itemsQuantity ?? null,
    paid: false,
  }));

  if (filled.itemsAdded < 1) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
