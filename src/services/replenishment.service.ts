/**
 * Reposición por consumo del hogar.
 * Lee purchase_history, estima cuándo se acaba cada producto
 * y deja el aviso en la app. No paga ni arma un pedido.
 */

import { prisma } from '@/lib/prisma';
import { familyWhere } from '@/lib/family';
import { productIdentity } from './catalog/normalize';
import { forecastProducts, ProductForecast, PurchaseEvent } from './consumption/predict';
import { allowsProposedItem, ProposalConstraints } from './household/constraints';
import { loadProposalConstraintsForUser } from './household/load-constraints';
import { priceQuery, RawOffer } from './offer-pricing';
import { deliverAlerts, AlertDraft } from './notifications/channels';
import { applyPendingPurchases, refreshProfiles } from './consumption/sync';

export interface ReplenishmentAlert {
  productName: string;
  category: string;
  urgency: 'add_now' | 'add_soon' | 'monitor';
  message: string;
  estimatedRunOutDate: string;
  daysUntilEmpty: number;
  suggestedQuantity: number;
  confidence: ProductForecast['confidence'];
  weeklyAmount: number | null;
  unit: string;
  lastStore?: string | null;
  cheapestStore?: string | null;
  cheapestPayable?: number | null;
  cheapestNote?: string | null;
  history: ProductForecast['history'];
}

export interface MonthlyShoppingPlan {
  userId: string;
  generatedAt: string;
  monthTarget: string;
  alerts: ReplenishmentAlert[];
  products: ReplenishmentAlert[];
  estimatedTotal: number;
  summary: {
    addNow: number;
    addSoon: number;
    monitoring: number;
  };
}

async function householdEvents(userId: string): Promise<PurchaseEvent[]> {
  const family = await familyWhere(userId);
  const rows = await prisma.purchaseHistory.findMany({
    where: family,
    orderBy: { purchasedAt: 'asc' },
  });
  return rows.map((row) => ({
    productName: row.productName,
    quantity: row.quantity,
    unit: row.unit,
    purchasedAt: row.purchasedAt,
    price: row.price,
    storeName: row.storeName,
    storeSlug: row.storeSlug,
  }));
}

async function cheapestOffer(
  forecast: ProductForecast,
  constraints: ProposalConstraints,
): Promise<{ store: string; payable: number; note: string } | null> {
  const observations = (await prisma.priceObservation.findMany({
    orderBy: { observedAt: 'desc' },
    take: 300,
  })).filter((row) => productIdentity(row.productName) === forecast.identity);
  if (!observations.length) return null;
  const offers: RawOffer[] = observations.map((row) => ({
    name: row.productName,
    store: row.storeName,
    price: row.price,
    inStock: row.inStock,
  }));
  const request = `${forecast.label} ${forecast.suggestedQuantity} ${forecast.unit}`;
  const priced = priceQuery(request, offers, constraints);
  if (!priced.cheapest) return null;
  return {
    store: priced.cheapest.store,
    payable: priced.cheapest.payable,
    note: priced.cheapest.note,
  };
}

function toAlert(forecast: ProductForecast, cheapest?: { store: string; payable: number; note: string } | null): ReplenishmentAlert | null {
  if (forecast.urgency === 'none' && forecast.confidence === 'insuficiente') {
    return {
      productName: forecast.label,
      category: '',
      urgency: 'monitor',
      message: forecast.message,
      estimatedRunOutDate: '',
      daysUntilEmpty: forecast.daysLeft ?? 0,
      suggestedQuantity: forecast.suggestedQuantity,
      confidence: forecast.confidence,
      weeklyAmount: forecast.weeklyAmount,
      unit: forecast.unit,
      lastStore: forecast.lastStore,
      history: forecast.history,
    };
  }
  if (forecast.urgency === 'none') return null;
  const priced = cheapest && forecast.alert
    ? ` Hoy sale más barato en ${cheapest.store} ($${cheapest.payable.toLocaleString('es-CL')} por lo que sueles llevar).`
    : '';
  return {
    productName: forecast.label,
    category: '',
    urgency: forecast.urgency,
    message: `${forecast.message}${priced}`,
    estimatedRunOutDate: forecast.predictedDate || '',
    daysUntilEmpty: forecast.daysLeft ?? 0,
    suggestedQuantity: forecast.suggestedQuantity,
    confidence: forecast.confidence,
    weeklyAmount: forecast.weeklyAmount,
    unit: forecast.unit,
    lastStore: forecast.lastStore,
    cheapestStore: cheapest?.store || null,
    cheapestPayable: cheapest?.payable ?? null,
    cheapestNote: cheapest?.note || null,
    history: forecast.history,
  };
}

export async function analyzeHousehold(userId: string, now = new Date()): Promise<ReplenishmentAlert[]> {
  const forecasts = forecastProducts(await householdEvents(userId), now);
  const constraints = await loadProposalConstraintsForUser(userId);
  const alerts: ReplenishmentAlert[] = [];
  for (const forecast of forecasts) {
    if (!allowsProposedItem(forecast.label, constraints)) continue;
    const cheapest = forecast.alert ? await cheapestOffer(forecast, constraints) : null;
    const alert = toAlert(forecast, cheapest);
    if (alert) alerts.push(alert);
  }
  return alerts;
}

export async function analyzeConsumptionHistory(userId: string) {
  const products = await analyzeHousehold(userId);
  return products.map((item) => ({
    productName: item.productName,
    category: item.category,
    totalPurchases: item.history.length,
    totalQuantity: item.history.reduce((sum, point) => sum + point.amount, 0),
    avgDaysBetweenPurchases: item.weeklyAmount ? Math.round(7 / Math.max(item.weeklyAmount, 0.1) * (item.suggestedQuantity || 1)) : 0,
    avgQuantityPerPurchase: item.suggestedQuantity,
    lastPurchaseDate: item.history[item.history.length - 1]?.date || null,
    daysSinceLastPurchase: null,
    estimatedStockDays: item.daysUntilEmpty,
    status: item.urgency === 'add_now' ? 'empty' : item.urgency === 'add_soon' ? 'low' : 'ok',
    confidence: item.confidence,
    weeklyAmount: item.weeklyAmount,
    unit: item.unit,
    history: item.history,
    message: item.message,
  }));
}

export async function generateReplenishmentAlerts(userId: string, _daysAhead?: number): Promise<ReplenishmentAlert[]> {
  const products = await analyzeHousehold(userId);
  return products.filter(alertWorthy);
}

function alertWorthy(item: ReplenishmentAlert): boolean {
  return item.urgency === 'add_now' || item.urgency === 'add_soon';
}

export async function generateMonthlyPlan(userId: string): Promise<MonthlyShoppingPlan> {
  const products = await analyzeHousehold(userId);
  const alerts = products.filter((item) => item.confidence !== 'insuficiente');
  const now = new Date();
  const summary = {
    addNow: alerts.filter((item) => item.urgency === 'add_now').length,
    addSoon: alerts.filter((item) => item.urgency === 'add_soon').length,
    monitoring: alerts.filter((item) => item.urgency === 'monitor').length,
  };
  const estimatedTotal = alerts.reduce((sum, item) => sum + (item.cheapestPayable || 0), 0);
  return {
    userId,
    generatedAt: now.toISOString(),
    monthTarget: now.toISOString().slice(0, 7),
    alerts,
    products,
    estimatedTotal,
    summary,
  };
}

export async function syncReplenishmentAlerts(now = new Date(), onlyUserId?: string): Promise<{ users: number; sent: number; updated: number }> {
  if (!onlyUserId) {
    await applyPendingPurchases(now);
    await refreshProfiles(now);
  }
  const users = await prisma.user.findMany({
    where: onlyUserId ? { id: onlyUserId } : undefined,
    select: { id: true },
  });
  const drafts: AlertDraft[] = [];
  for (const user of users) {
    const products = await analyzeHousehold(user.id, now);
    for (const item of products) {
      if (!alertWorthy(item)) continue;
      drafts.push({
        userId: user.id,
        dedupeTitle: `Se acaba: ${item.productName}`,
        title: `Se acaba: ${item.productName}`,
        message: item.message,
        level: item.urgency === 'add_now' ? 'warn' : 'info',
      });
    }
  }
  const delivered = await deliverAlerts(drafts);
  return { users: users.length, sent: delivered.sent, updated: delivered.updated };
}

export async function autoAddToShoppingList(
  userId: string,
  listId?: string,
  urgencyThreshold: 'add_now' | 'add_soon' = 'add_now',
  productName?: string
): Promise<{ listId: string; addedItems: string[] }> {
  const alerts = (await analyzeHousehold(userId)).filter((item) => item.confidence !== 'insuficiente');
  const toAdd = productName
    ? alerts.filter((item) => item.productName.toLowerCase() === productName.toLowerCase())
    : alerts.filter((item) => urgencyThreshold === 'add_now' ? item.urgency === 'add_now' : item.urgency === 'add_now' || item.urgency === 'add_soon');

  if (toAdd.length === 0) return { listId: listId || '', addedItems: [] };

  let targetListId = listId;
  if (!targetListId) {
    const monthName = new Date().toLocaleDateString('es-CL', { month: 'long' });
    const list = await prisma.shoppingList.create({
      data: { userId, name: `Reposición ${monthName}` },
    });
    targetListId = list.id;
  }

  const existingItems = await prisma.shoppingItem.findMany({
    where: { shoppingListId: targetListId },
    select: { name: true },
  });
  const existingNames = new Set(existingItems.map((item) => item.name.toLowerCase()));
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
