import { z } from 'zod';
import { STORE_NAMES } from './nutrition';
import type { AllergenCheckResult } from './nutrition';

// El familyId nunca viene en los argumentos: sale del token Bearer.

export const proposeCartItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(999),
  unit: z.string().trim().min(1).max(20).default('un'),
  unitPriceClp: z.number().int().nonnegative().max(10_000_000).optional(),
  canonicalProductId: z.string().trim().min(1).optional(),
  productNutritionId: z.string().trim().min(1).optional(),
});
export type ProposeCartItemInput = z.infer<typeof proposeCartItemSchema>;

export const proposeCartShape = {
  store: z.enum(STORE_NAMES),
  items: z.array(proposeCartItemSchema).min(1).max(100),
  note: z.string().trim().max(500).optional(),
};
export const proposeCartSchema = z.object(proposeCartShape);
export type ProposeCartInput = z.infer<typeof proposeCartSchema>;

export const checkAllergensShape = {
  productNutritionId: z.string().trim().min(1),
};

// Registrar un pedido YA comprado y pagado por la familia (historial real, no una propuesta).
// Idempotente por orderRef: no duplica si ya se registró.
export const recordOrderLineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(9999),
  unit: z.string().trim().min(1).max(20).default('un'),
  // Precio unitario en CLP. null/omitido cuando no se conoce (p. ej. Vanish recarga).
  unitPriceClp: z.number().int().nonnegative().max(10_000_000).nullable().optional(),
  brand: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  barcode: z.string().trim().max(40).optional(),
  canonicalProductId: z.string().trim().min(1).optional(),
});
export type RecordOrderLineInput = z.infer<typeof recordOrderLineSchema>;

export const recordOrderShape = {
  store: z.enum(STORE_NAMES),
  // Referencia única del pedido en la tienda (canónica, p. ej. "v244113174jmch-01").
  orderRef: z.string().trim().min(1).max(120),
  placedAt: z.string().trim().min(1).optional(),
  deliveredAt: z.string().trim().min(1).optional(),
  // Total REALMENTE cobrado en CLP (incluye cobros adicionales), no el checkout inicial.
  total: z.number().int().nonnegative().max(100_000_000),
  subtotal: z.number().int().nonnegative().max(100_000_000).optional(),
  deliveryFee: z.number().int().nonnegative().max(10_000_000).optional(),
  // Carros AVI asociados; se marcan como "ordered" si existen en la familia.
  cartIds: z.array(z.string().trim().min(1)).max(20).optional(),
  lines: z.array(recordOrderLineSchema).min(1).max(300),
  note: z.string().trim().max(1000).optional(),
};
export const recordOrderSchema = z.object(recordOrderShape);
export type RecordOrderInput = z.infer<typeof recordOrderSchema>;

export const approveItemShape = {
  cartId: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
  approverMemberId: z.string().trim().min(1),
  approved: z.boolean(),
};

export const approveCartShape = {
  cartId: z.string().trim().min(1),
  approverMemberId: z.string().trim().min(1),
  /** Aprueba de una vez los ítems aún sin decidir. */
  approvePending: z.boolean().default(false),
};

export interface HouseholdMember {
  id: string;
  name: string;
  role: string;
  type: string;
  allergies: string[];
  dietType: string | null;
  dietTags: string[];
  ageRange: string | null;
  isApprover: boolean;
}

export interface HouseholdResult {
  familyId: string;
  familyName: string;
  approverMemberIds: string[];
  members: HouseholdMember[];
  hasPets: boolean;
}

export interface LockedProduct {
  memberId: string;
  memberName: string;
  group: string;
  canonicalProductId: string;
  name: string;
  brand: string | null;
  format: string | null;
}

export interface ProposedCartItemResult {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  payable: number;
  allergenCheck: AllergenCheckResult | null;
}

export interface ProposedCartResult {
  cartId: string;
  store: string;
  status: 'proposed';
  subtotal: number;
  items: ProposedCartItemResult[];
  requiresApproval: boolean;
}

export interface PantryItem {
  group: string;
  category: string;
  estStock: number;
  baseUnit: string;
  runOutAt: string | null;
  confidence: string;
  kcal100g: number | null;
}

// Carro real en la tienda (lo ejecuta el worker de tiendas, nunca paga).
export const fillCartShape = {
  cartId: z.string().trim().min(1),
};

export const deliveryWindowsShape = {
  store: z.enum(STORE_NAMES),
  /** Si no viene, se usa la dirección principal de la familia. */
  street: z.string().trim().min(1).max(200).optional(),
  number: z.string().trim().max(20).optional(),
  comuna: z.string().trim().max(100).optional(),
};
