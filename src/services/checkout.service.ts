/**
 * Checkout Service — Deep Link al carrito del supermercado
 *
 * Genera links directos a los productos en cada supermercado.
 * El usuario hace click → ve el producto → agrega al carrito → paga.
 *
 * No requiere login automatico ni viola ToS.
 */

export interface CheckoutItem {
  productName: string;
  brand?: string;
  store: string;
  storeSlug: string;
  price: number;
  quantity: number;
  productUrl?: string;
  searchUrl: string;
}

export interface CheckoutPlan {
  stores: Array<{
    name: string;
    slug: string;
    items: CheckoutItem[];
    subtotal: number;
    deliveryFee: number;
    searchAllUrl: string;
  }>;
  totalEstimated: number;
  itemCount: number;
  generatedAt: string;
}

const STORE_CONFIG: Record<string, {
  name: string;
  searchUrlTemplate: (query: string) => string;
  deliveryFee: number;
  color: string;
}> = {
  jumbo: {
    name: 'Jumbo',
    searchUrlTemplate: (q) => `https://www.jumbo.cl/search?ft=${encodeURIComponent(q)}`,
    deliveryFee: 2990,
    color: '#16a34a',
  },
  lider: {
    name: 'Lider',
    searchUrlTemplate: (q) => `https://super.lider.cl/search?q=${encodeURIComponent(q)}`,
    deliveryFee: 2490,
    color: '#dc2626',
  },
  unimarc: {
    name: 'Unimarc',
    searchUrlTemplate: (q) => `https://www.unimarc.cl/buscar?q=${encodeURIComponent(q)}`,
    deliveryFee: 2790,
    color: '#ea580c',
  },
  'santa-isabel': {
    name: 'Santa Isabel',
    searchUrlTemplate: (q) => `https://www.santaisabel.cl/buscar?ft=${encodeURIComponent(q)}`,
    deliveryFee: 3490,
    color: '#2563eb',
  },
};

/**
 * Genera un plan de checkout con deep links para cada producto
 * agrupado por tienda.
 */
export function generateCheckoutPlan(
  items: Array<{
    productName: string;
    brand?: string;
    store: string;
    storeSlug: string;
    price: number;
    quantity: number;
    productUrl?: string;
  }>
): CheckoutPlan {
  const storeGroups = new Map<string, CheckoutItem[]>();

  for (const item of items) {
    const slug = item.storeSlug.toLowerCase();
    const config = STORE_CONFIG[slug];
    if (!config) continue;

    const group = storeGroups.get(slug) || [];
    group.push({
      ...item,
      searchUrl: item.productUrl || config.searchUrlTemplate(
        item.brand ? `${item.productName} ${item.brand}` : item.productName
      ),
    });
    storeGroups.set(slug, group);
  }

  const stores = Array.from(storeGroups.entries()).map(([slug, storeItems]) => {
    const config = STORE_CONFIG[slug]!;
    const subtotal = storeItems.reduce((s, i) => s + i.price * i.quantity, 0);

    // URL que busca todos los productos de esa tienda
    const allTerms = storeItems.map((i) => i.productName).join(' ');
    const searchAllUrl = config.searchUrlTemplate(allTerms.slice(0, 100));

    return {
      name: config.name,
      slug,
      items: storeItems,
      subtotal,
      deliveryFee: config.deliveryFee,
      searchAllUrl,
    };
  });

  const totalEstimated = stores.reduce((s, st) => s + st.subtotal + st.deliveryFee, 0);

  return {
    stores,
    totalEstimated,
    itemCount: items.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Genera mensaje de WhatsApp/chat con los links de compra
 */
export function formatCheckoutMessage(plan: CheckoutPlan): string {
  const lines: string[] = [];
  lines.push('🛒 *Tu compra esta lista*\n');

  for (const store of plan.stores) {
    lines.push(`*${store.name}* (${store.items.length} productos)`);
    for (const item of store.items) {
      const price = `$${(item.price * item.quantity).toLocaleString('es-CL')}`;
      lines.push(`  • ${item.productName}${item.brand ? ` (${item.brand})` : ''} x${item.quantity} — ${price}`);
      lines.push(`    👉 ${item.searchUrl}`);
    }
    lines.push(`  📦 Despacho: $${store.deliveryFee.toLocaleString('es-CL')}`);
    lines.push(`  💰 Subtotal: $${(store.subtotal + store.deliveryFee).toLocaleString('es-CL')}`);
    lines.push('');
  }

  lines.push(`*Total estimado: $${plan.totalEstimated.toLocaleString('es-CL')}*`);
  lines.push('\nAbre cada link, agrega al carrito y paga. AVI te avisa cuando llegue.');

  return lines.join('\n');
}
