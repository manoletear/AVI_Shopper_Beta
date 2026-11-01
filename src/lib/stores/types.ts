import { z } from 'zod';
import { STORE_NAMES, type StoreName } from '@/types/nutrition';

/**
 * Contrato común para Jumbo, Lider, Unimarc y Tottus.
 * Regla dura: ningún adaptador hace checkout ni paga. Se detiene en el carro lleno.
 */

export const storeSlugSchema = z.enum(STORE_NAMES);
export type StoreSlug = StoreName;

/** Credenciales de un solo uso: se usan para obtener cookies y se descartan. Nunca se guardan. */
export const loginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const searchProductInputSchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    ean: z.string().trim().regex(/^\d{8,14}$/).optional(),
    sku: z.string().trim().min(1).max(50).optional(),
  })
  .refine((v) => v.query || v.ean || v.sku, { message: 'Indica query, ean o sku' });
export type SearchProductInput = z.infer<typeof searchProductInputSchema>;

export const cartItemInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(99),
  productUrl: z.string().url().optional(),
  sku: z.string().trim().min(1).max(50).optional(),
});
export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export const addressInputSchema = z.object({
  street: z.string().trim().min(1).max(200),
  number: z.string().trim().max(20).optional(),
  comuna: z.string().trim().max(100).optional(),
});
export type AddressInput = z.infer<typeof addressInputSchema>;

export const storeProductSchema = z.object({
  sku: z.string().nullable(),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  available: z.boolean(),
  url: z.string().url().nullable(),
});
export type StoreProduct = z.infer<typeof storeProductSchema>;

export const storeCartItemSchema = z.object({
  sku: z.string().nullable(),
  name: z.string(),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().int().nonnegative(),
  totalPrice: z.number().int().nonnegative(),
});
export type StoreCartItem = z.infer<typeof storeCartItemSchema>;

export const storeCartSchema = z.object({
  items: z.array(storeCartItemSchema),
  subtotal: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type StoreCart = z.infer<typeof storeCartSchema>;

export const deliveryWindowSchema = z.object({
  id: z.string(),
  date: z.string(),
  timeRange: z.string(),
  price: z.number().int().nonnegative(),
  available: z.boolean(),
});
export type DeliveryWindow = z.infer<typeof deliveryWindowSchema>;

/**
 * ok: sesión válida. needs_user_action: captcha, 2FA o verificación humana;
 * la familia la completa, AVI no la evade. expired: hay que volver a conectar.
 */
export type SessionStatus = 'ok' | 'needs_user_action' | 'expired' | 'error';

export interface SessionResult {
  status: SessionStatus;
  message?: string;
  /** Cookies serializadas (JSON). Solo viven en memoria hasta cifrarlas. */
  sessionCookies?: string;
}

export interface AddToCartResult {
  added: Array<{ name: string; quantity: number }>;
  failed: Array<{ name: string; reason: 'not_found' | 'out_of_stock' | 'needs_user_action' | 'error' }>;
}

export interface StoreAdapter {
  readonly slug: StoreSlug;
  /** Inicia sesión con credenciales de un solo uso y devuelve las cookies. */
  login(credentials: LoginInput): Promise<SessionResult>;
  /** Restaura una sesión guardada (cookies descifradas). */
  restoreSession(sessionCookies: string): Promise<SessionResult>;
  searchProduct(input: SearchProductInput): Promise<StoreProduct[]>;
  addToCart(items: CartItemInput[]): Promise<AddToCartResult>;
  getCart(): Promise<StoreCart>;
  getDeliveryWindows(address: AddressInput): Promise<DeliveryWindow[]>;
  clearCart(): Promise<void>;
  close(): Promise<void>;
}

/** Error que necesita acción de la familia (captcha, 2FA). Nunca se intenta evadir. */
export class NeedsUserActionError extends Error {
  readonly code = 'needs_user_action';
}
