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
