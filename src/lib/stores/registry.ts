import type { StoreAdapter, StoreSlug } from './types';

/**
 * Adaptadores disponibles. Import dinámico para que el bundle de Vercel no cargue Playwright.
 * Lider, Unimarc y Tottus implementan la misma interfaz cuando se agreguen.
 */
const factories: Partial<Record<StoreSlug, () => Promise<StoreAdapter>>> = {
  jumbo: async () => new (await import('./jumbo')).JumboAdapter(),
};

export function availableStores(): StoreSlug[] {
  return Object.keys(factories) as StoreSlug[];
}

export async function createStoreAdapter(slug: StoreSlug): Promise<StoreAdapter> {
  const factory = factories[slug];
  if (!factory) throw new Error(`Todavía no hay adaptador para ${slug}`);
  return factory();
}
