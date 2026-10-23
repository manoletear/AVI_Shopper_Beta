import { JumboProduct } from './types';
import { normalizeGrocery } from './match';

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function parseJumboSearchHtml(html: string): JumboProduct[] {
  const products: JumboProduct[] = [];
  const seen = new Set<string>();
  const impression = /data-gtm-impression="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = impression.exec(html))) {
    let data: { name?: string; id?: string | number; price?: number | string; brand?: string };
    try {
      data = JSON.parse(decodeHtml(match[1]));
    } catch {
      continue;
    }
    const name = data.name?.trim();
    const sku = data.id != null ? String(data.id).trim() : '';
    if (!name || !sku || seen.has(sku)) continue;
    seen.add(sku);
    const price = Number(data.price);
    products.push({
      name,
      sku,
      brand: data.brand ? String(data.brand) : undefined,
      price: Number.isFinite(price) ? Math.round(price) : undefined,
    });
  }

  const urls = new Map<string, string>();
  const scripts = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  while ((match = scripts.exec(html))) {
    try {
      const data = JSON.parse(match[1]);
      const elements = Array.isArray(data.itemListElement) ? data.itemListElement : [];
      for (const element of elements) {
        const name = element?.name || element?.item?.name;
        const url = element?.url || element?.item?.url;
        if (typeof name === 'string' && typeof url === 'string') {
          urls.set(normalizeGrocery(name), url);
        }
      }
    } catch {
      continue;
    }
  }

  for (const product of products) {
    const url = urls.get(normalizeGrocery(product.name));
    if (url) product.productUrl = url;
  }

  return products;
}
