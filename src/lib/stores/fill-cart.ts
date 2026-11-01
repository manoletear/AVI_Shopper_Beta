import { decryptSession, encryptSession } from './crypto';
import { sameProduct } from './guards';
import type { AddressInput, DeliveryWindow, StoreAdapter, StoreCart, StoreProduct, StoreSlug } from './types';

/**
 * Llena el carro REAL de la tienda desde un proposed_cart APROBADO.
 * AVI propone, la familia decide: solo agrega ítems aprobados; si algo no
 * tiene stock propone un sustituto PENDIENTE de aprobación y no lo agrega.
 * Se detiene en el carro lleno. Nunca hace checkout ni paga.
 */

/** Errores con mensaje seguro para mostrar al cliente MCP. */
export class StoreToolError extends Error {}

export interface ApprovedItem {
  id: string;
  name: string;
  quantity: number;
  payable: number;
  canonicalProductId: string | null;
}

export interface StoreRepo {
  getCart(familyId: string, cartId: string): Promise<{ id: string; storeSlug: string; status: string } | null>;
  getApprovedItems(cartId: string): Promise<ApprovedItem[]>;
  /** URL de la ficha en la tienda para el producto canónico (producto fijo), si la conocemos. */
  findListingUrl(storeSlug: string, canonicalProductId: string): Promise<string | null>;
  getConnection(familyId: string, storeSlug: string): Promise<{ encryptedSession: string; status: string } | null>;
  saveConnection(familyId: string, storeSlug: string, data: { encryptedSession?: string; status: string }): Promise<void>;
  saveFill(record: FillRecord): Promise<string>;
  markCartFilled(cartId: string): Promise<void>;
}

export interface SubstituteProposal {
  itemId: string;
  name: string;
  reason: 'out_of_stock' | 'not_found' | 'needs_user_action' | 'error';
  candidate: StoreProduct | null;
  /** Pendiente: el aprobador debe decidir. Nunca se agrega solo. */
  approval: 'pending';
}

export interface CartComparison {
  matches: boolean;
  missing: Array<{ name: string; expected: number; inStore: number }>;
  extraInStore: Array<{ name: string; quantity: number }>;
  approvedTotal: number;
  storeTotal: number;
  diffClp: number;
}

export interface FillRecord {
  familyId: string;
  cartId: string;
  storeSlug: string;
  status: 'filled' | 'partial' | 'needs_user_action' | 'failed';
  itemsRequested: number;
  itemsAdded: number;
  approvedTotal: number;
  storeTotal: number | null;
  substitutes: SubstituteProposal[];
  comparison: CartComparison | null;
  message: string | null;
}

export interface FillCartResult extends FillRecord {
  fillId: string;
}

export interface StoreDeps {
  repo: StoreRepo;
  createAdapter: (slug: StoreSlug) => Promise<StoreAdapter>;
  storeKey?: string;
}

const STORES: readonly string[] = ['jumbo', 'lider', 'unimarc', 'tottus'];

export function compareCarts(approved: Array<{ name: string; quantity: number; payable: number }>, store: StoreCart): CartComparison {
  const used = new Set<number>();
  const missing: CartComparison['missing'] = [];
  for (const item of approved) {
    const index = store.items.findIndex((row, i) => !used.has(i) && sameProduct(item.name, row.name));
    if (index === -1) {
      missing.push({ name: item.name, expected: item.quantity, inStore: 0 });
      continue;
    }
    used.add(index);
    if (store.items[index].quantity < item.quantity) {
      missing.push({ name: item.name, expected: item.quantity, inStore: store.items[index].quantity });
    }
  }
  const extraInStore = store.items
    .filter((_, i) => !used.has(i))
    .map((row) => ({ name: row.name, quantity: row.quantity }));
  const approvedTotal = approved.reduce((sum, item) => sum + item.payable, 0);
  return {
    matches: missing.length === 0 && extraInStore.length === 0,
    missing,
    extraInStore,
    approvedTotal,
    storeTotal: store.total,
    diffClp: store.total - approvedTotal,
  };
}

async function openSession(deps: StoreDeps, familyId: string, storeSlug: StoreSlug) {
  const connection = await deps.repo.getConnection(familyId, storeSlug);
  if (!connection) throw new StoreToolError(`La familia no ha conectado su cuenta de ${storeSlug}`);
  if (connection.status === 'pending' || !connection.encryptedSession) {
    throw new StoreToolError(`La conexión con ${storeSlug} aún no se completa en el worker`);
  }
  if (connection.status === 'needs_user_action') {
    return { adapter: null, status: 'needs_user_action' as const };
  }
  const ctx = { familyId, storeSlug };
  const cookies = decryptSession(connection.encryptedSession, ctx, deps.storeKey);
  const adapter = await deps.createAdapter(storeSlug);
  const session = await adapter.restoreSession(cookies);
  if (session.status !== 'ok') {
    await deps.repo.saveConnection(familyId, storeSlug, {
      status: session.status === 'needs_user_action' ? 'needs_user_action' : 'expired',
    });
    await adapter.close();
    return { adapter: null, status: session.status === 'needs_user_action' ? ('needs_user_action' as const) : ('expired' as const) };
  }
  // Cookies renovadas: se vuelven a cifrar; lastVerifiedAt lo actualiza el repo.
  await deps.repo.saveConnection(familyId, storeSlug, {
    status: 'active',
    encryptedSession: session.sessionCookies ? encryptSession(session.sessionCookies, ctx, deps.storeKey) : undefined,
  });
  return { adapter, status: 'ok' as const };
}

export async function fillCart(familyId: string, cartId: string, deps: StoreDeps): Promise<FillCartResult> {
  const cart = await deps.repo.getCart(familyId, cartId);
  if (!cart) throw new StoreToolError('No encontré ese carro en esta familia');
  if (cart.status !== 'approved') {
    throw new StoreToolError(`El carro debe estar aprobado por quien aprueba en la familia (estado: "${cart.status}")`);
  }
  if (!STORES.includes(cart.storeSlug)) throw new StoreToolError(`Tienda desconocida: ${cart.storeSlug}`);
  const storeSlug = cart.storeSlug as StoreSlug;
  const items = await deps.repo.getApprovedItems(cart.id);
  if (items.length === 0) throw new StoreToolError('El carro no tiene ítems aprobados');

  const base = {
    familyId,
    cartId: cart.id,
    storeSlug,
    itemsRequested: items.length,
    approvedTotal: items.reduce((sum, item) => sum + item.payable, 0),
  };
  const finish = async (record: FillRecord): Promise<FillCartResult> => ({ ...record, fillId: await deps.repo.saveFill(record) });

  const { adapter, status } = await openSession(deps, familyId, storeSlug);
  if (!adapter) {
    return finish({
      ...base,
      status: status === 'needs_user_action' ? 'needs_user_action' : 'failed',
      itemsAdded: 0,
      storeTotal: null,
      substitutes: [],
      comparison: null,
      message:
        status === 'needs_user_action'
          ? `${storeSlug} pide una verificación (captcha o código). Complétala y vuelve a conectar la cuenta.`
          : `La sesión de ${storeSlug} expiró. Vuelve a conectar la cuenta.`,
    });
  }

  try {
    const substitutes: SubstituteProposal[] = [];
    const toAdd: Array<{ item: ApprovedItem; url: string }> = [];

    for (const item of items) {
      // Producto fijo: la ficha exacta guardada en store_listings.
      const listingUrl = item.canonicalProductId ? await deps.repo.findListingUrl(storeSlug, item.canonicalProductId) : null;
      if (listingUrl) {
        toAdd.push({ item, url: listingUrl });
        continue;
      }
      const results = await adapter.searchProduct({ query: item.name });
      const exact = results.find((p) => p.available && p.url && sameProduct(item.name, p.name));
      if (exact?.url) {
        toAdd.push({ item, url: exact.url });
        continue;
      }
      // No es el mismo producto aprobado: se propone y queda pendiente.
      const candidate = results.find((p) => p.available) ?? null;
      substitutes.push({ itemId: item.id, name: item.name, reason: candidate ? 'out_of_stock' : 'not_found', candidate, approval: 'pending' });
    }

    const added = await adapter.addToCart(
      toAdd.map(({ item, url }) => ({ name: item.name, quantity: Math.max(1, Math.round(item.quantity)), productUrl: url })),
    );
    for (const failure of added.failed) {
      const item = toAdd.find((entry) => entry.item.name === failure.name)?.item;
      if (!item) continue;
      let candidate: StoreProduct | null = null;
      if (failure.reason === 'out_of_stock') {
        const alternatives = await adapter.searchProduct({ query: item.name });
        candidate = alternatives.find((p) => p.available && !sameProduct(item.name, p.name)) ?? alternatives.find((p) => p.available) ?? null;
      }
      substitutes.push({ itemId: item.id, name: item.name, reason: failure.reason, candidate, approval: 'pending' });
    }

    const storeCart = await adapter.getCart();
    const addedNames = new Set(added.added.map((entry) => entry.name));
    const comparison = compareCarts(items.filter((item) => addedNames.has(item.name)), storeCart);
    const needsUser = added.failed.some((failure) => failure.reason === 'needs_user_action');
    const complete = substitutes.length === 0 && comparison.matches;

    if (complete) await deps.repo.markCartFilled(cart.id);
    return finish({
      ...base,
      status: needsUser ? 'needs_user_action' : complete ? 'filled' : 'partial',
      itemsAdded: added.added.length,
      storeTotal: storeCart.total,
      substitutes,
      comparison,
      message: complete
        ? 'Carro lleno en la tienda. AVI no pagó: la familia revisa y paga.'
        : 'Carro lleno a medias: revisa sustitutos pendientes y diferencias. AVI no pagó.',
    });
  } catch (error) {
    // Al log solo va el tipo de error, nunca cookies ni credenciales.
    console.error('fill_cart falló:', error instanceof Error ? error.name : 'unknown');
    return finish({
      ...base,
      status: 'failed',
      itemsAdded: 0,
      storeTotal: null,
      substitutes: [],
      comparison: null,
      message: 'No pude llenar el carro en la tienda',
    });
  } finally {
    await adapter.close();
  }
}

export async function getDeliveryWindows(
  familyId: string,
  storeSlug: StoreSlug,
  address: AddressInput,
  deps: StoreDeps,
): Promise<{ status: 'ok' | 'needs_user_action' | 'expired'; windows: DeliveryWindow[] }> {
  const { adapter, status } = await openSession(deps, familyId, storeSlug);
  if (!adapter) return { status, windows: [] };
  try {
    return { status: 'ok', windows: await adapter.getDeliveryWindows(address) };
  } finally {
    await adapter.close();
  }
}

/**
 * Conecta la cuenta: las credenciales se usan una vez y se descartan.
 * Solo se guardan cookies cifradas. Si hay captcha/2FA, needs_user_action.
 */
export async function connectStore(
  familyId: string,
  storeSlug: StoreSlug,
  credentials: { email: string; password: string },
  deps: StoreDeps,
): Promise<{ status: 'active' | 'needs_user_action' | 'error'; message?: string }> {
  const adapter = await deps.createAdapter(storeSlug);
  try {
    const session = await adapter.login(credentials);
    if (session.status === 'ok' && session.sessionCookies) {
      await deps.repo.saveConnection(familyId, storeSlug, {
        status: 'active',
        encryptedSession: encryptSession(session.sessionCookies, { familyId, storeSlug }, deps.storeKey),
      });
      return { status: 'active' };
    }
    if (session.status === 'needs_user_action') {
      return { status: 'needs_user_action', message: session.message };
    }
    return { status: 'error', message: session.message };
  } finally {
    await adapter.close();
  }
}
