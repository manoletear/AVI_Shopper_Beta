import { CartRequestItem } from './types';

const UNIMARC_ADD = 'https://www.unimarc.cl/checkout/cart/add';

/**
 * Unimarc sigue el patrón VTEX: un link abre el navegador de la persona
 * y agrega los SKU a SU carrito. No pasa por el pago.
 */
export function buildUnimarcCartLink(items: Array<Pick<CartRequestItem, 'sku' | 'quantity'>>): string | null {
  const withSku = items.filter((item) => item.sku && /^\d+$/.test(item.sku));
  if (withSku.length === 0) return null;

  const params = new URLSearchParams();
  for (const item of withSku) {
    params.append('sku', item.sku!);
    params.append('qty', String(Math.max(1, Math.min(24, item.quantity || 1))));
    params.append('seller', '1');
    params.append('sc', '1');
  }
  return `${UNIMARC_ADD}?${params.toString()}`;
}

export function unimarcSearchUrl(query: string): string {
  return `https://www.unimarc.cl/search?q=${encodeURIComponent(query)}`;
}
