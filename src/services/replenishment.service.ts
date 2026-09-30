/**
 * Replenishment Prediction Service
 *
 * Analiza el historial de compras de la familia para predecir
 * cuando se acabara cada producto y sugiere agregarlo a la
 * lista de compras del fin de mes.
 *
 * Modelo: calcula dias promedio entre compras por producto,
 * estima stock restante, y genera alertas con dias de anticipacion.
 *
 * Usa TypeSafe (Noul) para decisiones de confianza:
 * - ¿Es urgente reabastecer este producto?
 * - ¿Deberia sugerir una alternativa mas economica?
 */

import { prisma } from '@/lib/prisma';

// ============================================
// TIPOS
// ============================================

export interface ProductConsumption {
  productName: string;
  category: string;
  totalPurchases: number;
  totalQuantity: number;
  avgDaysBetweenPurchases: number;
  avgQuantityPerPurchase: number;
  lastPurchaseDate: Date;
  daysSinceLastPurchase: number;
  estimatedStockDays: number;
  status: 'ok' | 'low' | 'empty';
}

export interface ReplenishmentAlert {
  productName: string;
  category: string;
  urgency: 'add_now' | 'add_soon' | 'monitor';
  message: string;
  estimatedRunOutDate: string;
  daysUntilEmpty: number;
  suggestedQuantity: number;
  lastPrice?: number;
  lastStore?: string;
}

export interface MonthlyShoppingPlan {
  userId: string;
  generatedAt: string;
  monthTarget: string;
  alerts: ReplenishmentAlert[];
  estimatedTotal: number;
  summary: {
    addNow: number;
    addSoon: number;
    monitoring: number;
  };
}

// ============================================
// ANALISIS DE CONSUMO
// ============================================

/**
 * Analiza el historial de compras de un usuario y calcula
 * patrones de consumo por producto.
 */
export async function analyzeConsumptionHistory(
  userId: string,
  lookbackDays = 120
): Promise<ProductConsumption[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  // Obtener todas las ordenes entregadas
  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: { in: ['delivered', 'confirmed'] },
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Obtener items de listas de compras marcados como checked (comprados)
  const checkedItems = await prisma.shoppingItem.findMany({
    where: {
      shoppingList: { userId },
      checked: true,
      updatedAt: { gte: cutoff },
    },
    include: {
      product: true,
      shoppingList: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  // Consolidar todas las compras en un timeline por producto
  const productTimeline: Map<
    string,
    {
      purchases: Array<{ date: Date; quantity: number; price?: number; store?: string }>;
      category: string;
    }
  > = new Map();

  // De ordenes
  for (const order of orders) {
    let items: Array<{ name: string; quantity: number; price?: number }>;
    try {
      items = JSON.parse(order.items);
    } catch {
      continue;
    }

    for (const item of items) {
      const key = item.name.toLowerCase().trim();
      const existing = productTimeline.get(key) || { purchases: [], category: '' };
      existing.purchases.push({
        date: order.createdAt,
        quantity: item.quantity || 1,
        price: item.price,
      });
      productTimeline.set(key, existing);
    }
  }

  // De items checked en listas
  for (const item of checkedItems) {
    const key = item.name.toLowerCase().trim();
    const existing = productTimeline.get(key) || { purchases: [], category: '' };
    existing.purchases.push({
      date: item.updatedAt,
      quantity: item.quantity,
    });
    if (item.product?.category) {
      existing.category = item.product.category;
    }
    productTimeline.set(key, existing);
  }

  // Calcular patrones de consumo
  const consumptions: ProductConsumption[] = [];
  const now = new Date();

  for (const [productName, data] of productTimeline) {
    if (data.purchases.length < 2) continue;

    // Ordenar por fecha
    data.purchases.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calcular intervalos entre compras
    const intervals: number[] = [];
    for (let i = 1; i < data.purchases.length; i++) {
      const daysBetween = Math.round(
        (data.purchases[i].date.getTime() - data.purchases[i - 1].date.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysBetween > 0) intervals.push(daysBetween);
    }

    if (intervals.length === 0) continue;

    const avgDaysBetween = intervals.reduce((s, d) => s + d, 0) / intervals.length;
    const totalQty = data.purchases.reduce((s, p) => s + p.quantity, 0);
    const avgQtyPerPurchase = totalQty / data.purchases.length;
    const lastPurchase = data.purchases[data.purchases.length - 1];
    const daysSinceLast = Math.round(
      (now.getTime() - lastPurchase.date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Estimar dias de stock restante
    const estimatedStockDays = Math.max(0, Math.round(avgDaysBetween - daysSinceLast));

    // Determinar status
    let status: 'ok' | 'low' | 'empty';
    if (estimatedStockDays <= 0) {
      status = 'empty';
    } else if (estimatedStockDays <= 5) {
      status = 'low';
    } else {
      status = 'ok';
    }

    consumptions.push({
      productName,
      category: data.category,
      totalPurchases: data.purchases.length,
      totalQuantity: totalQty,
      avgDaysBetweenPurchases: Math.round(avgDaysBetween),
      avgQuantityPerPurchase: Number(avgQtyPerPurchase.toFixed(1)),
      lastPurchaseDate: lastPurchase.date,
      daysSinceLastPurchase: daysSinceLast,
      estimatedStockDays,
      status,
    });
  }

  // Ordenar: empty primero, luego low, luego ok
  const statusOrder = { empty: 0, low: 1, ok: 2 };
  return consumptions.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}

// ============================================
// GENERAR ALERTAS DE REPOSICION
// ============================================

/**
 * Genera alertas de reposicion basadas en el analisis de consumo.
 * Sugiere agregar productos a la lista de compras del fin de mes.
 */
export async function generateReplenishmentAlerts(
  userId: string,
  daysAhead = 30
): Promise<ReplenishmentAlert[]> {
  const consumptions = await analyzeConsumptionHistory(userId);
  const alerts: ReplenishmentAlert[] = [];

  for (const item of consumptions) {
    // Solo alertar productos que se van a acabar dentro del periodo
    if (item.estimatedStockDays > daysAhead && item.status === 'ok') continue;

    const runOutDate = new Date();
    runOutDate.setDate(runOutDate.getDate() + item.estimatedStockDays);

    let urgency: ReplenishmentAlert['urgency'];
    let message: string;

    if (item.status === 'empty') {
      urgency = 'add_now';
      message = `${item.productName} probablemente ya se acabó. Lo compras cada ~${item.avgDaysBetweenPurchases} días y la última vez fue hace ${item.daysSinceLastPurchase} días.`;
    } else if (item.status === 'low' || item.estimatedStockDays <= 7) {
      urgency = 'add_soon';
      message = `${item.productName} se acabará en ~${item.estimatedStockDays} días. Agrégalo a tu lista para la próxima compra.`;
    } else {
      urgency = 'monitor';
      message = `${item.productName} se acabará en ~${item.estimatedStockDays} días. Puedes planificar la compra.`;
    }

    alerts.push({
      productName: item.productName,
      category: item.category,
      urgency,
      message,
      estimatedRunOutDate: runOutDate.toISOString().split('T')[0],
      daysUntilEmpty: item.estimatedStockDays,
      suggestedQuantity: Math.ceil(item.avgQuantityPerPurchase),
    });
  }

  // Ordenar: add_now > add_soon > monitor
  const urgencyOrder = { add_now: 0, add_soon: 1, monitor: 2 };
  return alerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

// ============================================
// PLAN DE COMPRAS MENSUAL
// ============================================

/**
 * Genera un plan de compras para el mes, con todos los productos
 * que se van a necesitar y la cantidad sugerida.
 */
export async function generateMonthlyPlan(
  userId: string
): Promise<MonthlyShoppingPlan> {
  const alerts = await generateReplenishmentAlerts(userId, 30);

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthTarget = nextMonth.toISOString().split('T')[0].substring(0, 7);

  const summary = {
    addNow: alerts.filter((a) => a.urgency === 'add_now').length,
    addSoon: alerts.filter((a) => a.urgency === 'add_soon').length,
    monitoring: alerts.filter((a) => a.urgency === 'monitor').length,
  };

  return {
    userId,
    generatedAt: now.toISOString(),
    monthTarget,
    alerts,
    estimatedTotal: 0,
    summary,
  };
}

// ============================================
// AUTO-AGREGAR A LISTA
// ============================================

/**
 * Agrega automaticamente los productos urgentes a una lista
 * de compras existente o crea una nueva.
 */
export async function autoAddToShoppingList(
  userId: string,
  listId?: string,
  urgencyThreshold: 'add_now' | 'add_soon' = 'add_now'
): Promise<{ listId: string; addedItems: string[] }> {
  const alerts = await generateReplenishmentAlerts(userId, 30);

  const toAdd = alerts.filter((a) => {
    if (urgencyThreshold === 'add_now') return a.urgency === 'add_now';
    return a.urgency === 'add_now' || a.urgency === 'add_soon';
  });

  if (toAdd.length === 0) return { listId: listId || '', addedItems: [] };

  // Usar lista existente o crear una nueva
  let targetListId = listId;
  if (!targetListId) {
    const now = new Date();
    const monthName = now.toLocaleDateString('es-CL', { month: 'long' });
    const list = await prisma.shoppingList.create({
      data: {
        userId,
        name: `Reposición ${monthName}`,
      },
    });
    targetListId = list.id;
  }

  // Verificar que no esten ya en la lista
  const existingItems = await prisma.shoppingItem.findMany({
    where: { shoppingListId: targetListId },
    select: { name: true },
  });
  const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()));

  const addedItems: string[] = [];

  for (const alert of toAdd) {
    if (existingNames.has(alert.productName.toLowerCase())) continue;

    await prisma.shoppingItem.create({
      data: {
        shoppingListId: targetListId,
        name: alert.productName,
        quantity: alert.suggestedQuantity,
        urgent: alert.urgency === 'add_now',
      },
    });
    addedItems.push(alert.productName);
  }

  return { listId: targetListId, addedItems };
}
