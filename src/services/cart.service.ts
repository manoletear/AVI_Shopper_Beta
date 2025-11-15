import { prisma } from '@/lib/prisma';
import { StoreSuggestion, SplitCartResult, CartItem } from '@/types';

interface CompareItem {
  productId: string;
  name: string;
  quantity: number;
}

/**
 * Compares prices for a list of items across all stores
 */
export async function compareStorePrices(items: CompareItem[]): Promise<StoreSuggestion[]> {
  const suggestions: StoreSuggestion[] = [];

  // Get all stores
  const stores = await prisma.store.findMany();

  for (const store of stores) {
    const storeItems: CartItem[] = [];
    let subtotal = 0;

    for (const item of items) {
      // Find price for this product in this store
      const productPrice = await prisma.productPrice.findUnique({
        where: {
          productId_storeId: {
            productId: item.productId,
            storeId: store.id,
          },
        },
        include: {
          product: true,
        },
      });

      if (productPrice && productPrice.inStock) {
        const itemTotal = productPrice.price * item.quantity;
        subtotal += itemTotal;

        storeItems.push({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: productPrice.price,
          storeId: store.id,
          storeName: store.name,
        });
      }
    }

    // Only include stores that have all items in stock
    if (storeItems.length === items.length) {
      const total = subtotal + store.deliveryFee;

      suggestions.push({
        storeId: store.id,
        storeName: store.name,
        items: storeItems,
        subtotal,
        deliveryFee: store.deliveryFee,
        total,
      });
    }
  }

  // Sort by total price (cheapest first)
  return suggestions.sort((a, b) => a.total - b.total);
}

/**
 * Intelligently splits cart across multiple stores to minimize cost
 */
export async function splitCart(items: CompareItem[]): Promise<SplitCartResult> {
  // Get all stores
  const stores = await prisma.store.findMany();

  // Get prices for all items across all stores
  const itemPrices: Map<string, Map<string, { price: number; inStock: boolean }>> = new Map();

  for (const item of items) {
    const prices = await prisma.productPrice.findMany({
      where: { productId: item.productId },
      include: { store: true },
    });

    const storeMap = new Map<string, { price: number; inStock: boolean }>();
    for (const price of prices) {
      storeMap.set(price.storeId, { price: price.price, inStock: price.inStock });
    }

    itemPrices.set(item.productId, storeMap);
  }

  // Greedy algorithm: assign each item to the cheapest store
  const storeAssignments: Map<string, CompareItem[]> = new Map();

  for (const item of items) {
    const prices = itemPrices.get(item.productId);
    if (!prices) continue;

    let cheapestStoreId: string | null = null;
    let cheapestPrice = Infinity;

    for (const [storeId, priceData] of prices.entries()) {
      if (priceData.inStock && priceData.price < cheapestPrice) {
        cheapestPrice = priceData.price;
        cheapestStoreId = storeId;
      }
    }

    if (cheapestStoreId) {
      const storeItems = storeAssignments.get(cheapestStoreId) || [];
      storeItems.push(item);
      storeAssignments.set(cheapestStoreId, storeItems);
    }
  }

  // Build suggestions for each store
  const bags: StoreSuggestion[] = [];
  let splitTotal = 0;

  for (const [storeId, storeItems] of storeAssignments.entries()) {
    const store = stores.find(s => s.id === storeId);
    if (!store) continue;

    const cartItems: CartItem[] = [];
    let subtotal = 0;

    for (const item of storeItems) {
      const priceData = itemPrices.get(item.productId)?.get(storeId);
      if (!priceData) continue;

      const itemTotal = priceData.price * item.quantity;
      subtotal += itemTotal;

      cartItems.push({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: priceData.price,
        storeId: store.id,
        storeName: store.name,
      });
    }

    const total = subtotal + store.deliveryFee;
    splitTotal += total;

    bags.push({
      storeId: store.id,
      storeName: store.name,
      items: cartItems,
      subtotal,
      deliveryFee: store.deliveryFee,
      total,
    });
  }

  // Calculate consolidated option (single store)
  const consolidated = await compareStorePrices(items);
  const consolidatedOption = consolidated[0]; // Cheapest single store option

  // Calculate savings
  const totalSavings = consolidatedOption ? consolidatedOption.total - splitTotal : 0;
  const savingsPercentage = consolidatedOption ? (totalSavings / consolidatedOption.total) * 100 : 0;

  return {
    bags,
    totalSavings,
    savingsPercentage,
    consolidatedOption,
  };
}
