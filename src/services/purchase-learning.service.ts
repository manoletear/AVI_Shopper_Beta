/**
 * Purchase Learning Service
 *
 * AVI aprende de cada compra de la familia:
 * - Que productos compra (nombre exacto, marca, categoria)
 * - Donde los compra (tienda preferida por producto)
 * - Con que frecuencia los compra
 * - Cuanto gasta normalmente
 *
 * Con este conocimiento, AVI puede:
 * - Sugerir productos por nombre y marca exacta
 * - Recomendar la tienda donde siempre compra ese producto
 * - Predecir cuando necesita reabastecer
 * - Armar una lista completa basada en patrones
 */

import { prisma } from '@/lib/prisma';

// ============================================
// REGISTRAR COMPRA
// ============================================

export interface PurchaseInput {
  productName: string;
  brand?: string;
  category?: string;
  storeSlug?: string;
  storeName?: string;
  price?: number;
  quantity?: number;
  unit?: string;
  source?: string;
}

export async function recordPurchase(
  userId: string,
  purchase: PurchaseInput
): Promise<void> {
  await prisma.purchaseHistory.create({
    data: {
      userId,
      productName: purchase.productName,
      brand: purchase.brand || null,
      category: purchase.category || null,
      storeSlug: purchase.storeSlug || null,
      storeName: purchase.storeName || null,
      price: purchase.price || null,
      quantity: purchase.quantity || 1,
      unit: purchase.unit || null,
      source: purchase.source || 'manual',
    },
  });
}

export async function recordMultiplePurchases(
  userId: string,
  purchases: PurchaseInput[]
): Promise<number> {
  const result = await prisma.purchaseHistory.createMany({
    data: purchases.map((p) => ({
      userId,
      productName: p.productName,
      brand: p.brand || null,
      category: p.category || null,
      storeSlug: p.storeSlug || null,
      storeName: p.storeName || null,
      price: p.price || null,
      quantity: p.quantity || 1,
      unit: p.unit || null,
      source: p.source || 'list',
    })),
  });
  return result.count;
}

// ============================================
// ANALISIS DE PATRONES
// ============================================

export interface ProductProfile {
  productName: string;
  preferredBrand: string | null;
  preferredStore: string | null;
  avgPrice: number;
  totalPurchases: number;
  avgQuantity: number;
  avgDaysBetween: number;
  lastPurchased: Date;
  daysSinceLast: number;
  brands: Array<{ brand: string; count: number }>;
  stores: Array<{ store: string; count: number }>;
}

export async function getProductProfiles(
  userId: string,
  limit = 30
): Promise<ProductProfile[]> {
  const purchases = await prisma.purchaseHistory.findMany({
    where: { userId },
    orderBy: { purchasedAt: 'asc' },
  });

  if (purchases.length === 0) return [];

  // Agrupar por producto normalizado
  const byProduct = new Map<string, typeof purchases>();
  for (const p of purchases) {
    const key = p.productName.toLowerCase().trim();
    const arr = byProduct.get(key) || [];
    arr.push(p);
    byProduct.set(key, arr);
  }

  const profiles: ProductProfile[] = [];
  const now = new Date();

  for (const [, items] of byProduct) {
    if (items.length < 1) continue;

    // Marca preferida
    const brandCounts = new Map<string, number>();
    for (const i of items) {
      if (i.brand) brandCounts.set(i.brand, (brandCounts.get(i.brand) || 0) + 1);
    }
    const brands = Array.from(brandCounts.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count);

    // Tienda preferida
    const storeCounts = new Map<string, number>();
    for (const i of items) {
      if (i.storeName) storeCounts.set(i.storeName, (storeCounts.get(i.storeName) || 0) + 1);
    }
    const stores = Array.from(storeCounts.entries())
      .map(([store, count]) => ({ store, count }))
      .sort((a, b) => b.count - a.count);

    // Precio promedio
    const pricesWithValue = items.filter((i) => i.price && i.price > 0);
    const avgPrice = pricesWithValue.length > 0
      ? Math.round(pricesWithValue.reduce((s, i) => s + i.price!, 0) / pricesWithValue.length)
      : 0;

    // Frecuencia
    const intervals: number[] = [];
    for (let i = 1; i < items.length; i++) {
      const days = Math.round(
        (items[i].purchasedAt.getTime() - items[i - 1].purchasedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days > 0) intervals.push(days);
    }
    const avgDays = intervals.length > 0
      ? Math.round(intervals.reduce((s, d) => s + d, 0) / intervals.length)
      : 0;

    const lastPurchased = items[items.length - 1].purchasedAt;
    const daysSinceLast = Math.round((now.getTime() - lastPurchased.getTime()) / (1000 * 60 * 60 * 24));

    const avgQty = items.reduce((s, i) => s + i.quantity, 0) / items.length;

    profiles.push({
      productName: items[0].productName,
      preferredBrand: brands[0]?.brand || null,
      preferredStore: stores[0]?.store || null,
      avgPrice,
      totalPurchases: items.length,
      avgQuantity: Number(avgQty.toFixed(1)),
      avgDaysBetween: avgDays,
      lastPurchased,
      daysSinceLast,
      brands,
      stores,
    });
  }

  return profiles
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, limit);
}

// ============================================
// SUGERENCIAS INTELIGENTES
// ============================================

export async function getSuggestions(
  userId: string
): Promise<Array<{
  productName: string;
  brand: string | null;
  store: string | null;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  suggestedQuantity: number;
}>> {
  const profiles = await getProductProfiles(userId);
  const suggestions = [];

  for (const p of profiles) {
    if (p.totalPurchases < 2 || p.avgDaysBetween === 0) continue;

    const daysOverdue = p.daysSinceLast - p.avgDaysBetween;

    if (daysOverdue > 0) {
      suggestions.push({
        productName: p.productName,
        brand: p.preferredBrand,
        store: p.preferredStore,
        reason: `Compras ${p.productName}${p.preferredBrand ? ` (${p.preferredBrand})` : ''} cada ~${p.avgDaysBetween} dias. Ultimo: hace ${p.daysSinceLast} dias.`,
        urgency: daysOverdue > p.avgDaysBetween * 0.5 ? 'high' as const : 'medium' as const,
        suggestedQuantity: Math.ceil(p.avgQuantity),
      });
    } else if (p.avgDaysBetween - p.daysSinceLast <= 5) {
      suggestions.push({
        productName: p.productName,
        brand: p.preferredBrand,
        store: p.preferredStore,
        reason: `${p.productName} se acabara en ~${p.avgDaysBetween - p.daysSinceLast} dias.`,
        urgency: 'low' as const,
        suggestedQuantity: Math.ceil(p.avgQuantity),
      });
    }
  }

  return suggestions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}

/**
 * Genera un resumen del perfil de compras para el agente
 */
export async function getFamilyProfileSummary(
  userId: string
): Promise<string> {
  const profiles = await getProductProfiles(userId, 15);

  if (profiles.length === 0) {
    return 'Esta familia aun no tiene historial de compras. A medida que registren compras, AVI aprendera sus preferencias.';
  }

  const lines: string[] = [];
  lines.push(`La familia compra regularmente ${profiles.length} productos.`);

  // Productos mas frecuentes
  const top5 = profiles.slice(0, 5);
  lines.push('Productos favoritos:');
  for (const p of top5) {
    let desc = `- ${p.productName}`;
    if (p.preferredBrand) desc += ` (marca: ${p.preferredBrand})`;
    if (p.preferredStore) desc += `, compra en ${p.preferredStore}`;
    if (p.avgDaysBetween > 0) desc += `, cada ~${p.avgDaysBetween} dias`;
    if (p.avgPrice > 0) desc += `, ~$${p.avgPrice.toLocaleString('es-CL')}`;
    lines.push(desc);
  }

  // Tiendas favoritas
  const allStores = new Map<string, number>();
  for (const p of profiles) {
    for (const s of p.stores) {
      allStores.set(s.store, (allStores.get(s.store) || 0) + s.count);
    }
  }
  const topStores = Array.from(allStores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topStores.length > 0) {
    lines.push(`Tiendas preferidas: ${topStores.map(([s, c]) => `${s} (${c} compras)`).join(', ')}`);
  }

  return lines.join('\n');
}
