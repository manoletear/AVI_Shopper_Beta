import { z } from 'zod';

// ============================================
// USER VALIDATIONS
// ============================================

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  image: z.string().url().optional(),
});

// ============================================
// CONSENT VALIDATIONS
// ============================================

export const updateConsentSchema = z.object({
  precios: z.boolean().optional(),
  consumo: z.boolean().optional(),
  salud: z.boolean().optional(),
});

// ============================================
// SHOPPING LIST VALIDATIONS
// ============================================

export const createShoppingListSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').optional(),
});

export const createShoppingItemSchema = z.object({
  name: z.string().min(1, 'El nombre del producto es requerido'),
  quantity: z.number().int().positive().default(1),
  urgent: z.boolean().default(false),
  productId: z.string().optional(),
});

export const updateShoppingItemSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  urgent: z.boolean().optional(),
  checked: z.boolean().optional(),
});

// ============================================
// PRODUCT VALIDATIONS
// ============================================

export const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  category: z.string().min(1, 'La categoría es requerida'),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  imageUrl: z.string().url().optional(),
  calories: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  fiber: z.number().optional(),
  sugar: z.number().optional(),
  sodium: z.number().optional(),
  isUltraProcessed: z.boolean().default(false),
  nutritionScore: z.number().int().min(0).max(100).optional(),
});

// ============================================
// BUDGET VALIDATIONS
// ============================================

export const createBudgetSchema = z.object({
  period: z.enum(['weekly', 'monthly']),
  amount: z.number().int().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const updateBudgetSchema = z.object({
  amount: z.number().int().positive().optional(),
  spent: z.number().int().min(0).optional(),
});

// ============================================
// ORDER VALIDATIONS
// ============================================

export const createOrderSchema = z.object({
  storeId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().int().positive(),
    })
  ),
  subtotal: z.number().int().positive(),
  delivery: z.number().int().min(0),
  total: z.number().int().positive(),
  eta: z.string().datetime().optional(),
});

// ============================================
// PREFERENCE VALIDATIONS
// ============================================

export const updatePreferenceSchema = z.object({
  dietType: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  favorites: z.array(z.string()).optional(),
});
