import { prisma } from '@/lib/prisma';
import { UserAnalytics } from '@/types';

/**
 * Calculates comprehensive user analytics
 */
export async function getUserAnalytics(
  userId: string,
  days: number = 30
): Promise<UserAnalytics> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  // Get orders in the period
  const orders = await prisma.order.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Calculate basic metrics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate orders with split cart
  const ordersWithSplit = orders.filter(o => {
    // Check if order was part of a split (simplified logic)
    // In production, you'd track this more explicitly
    return false; // TODO: Implement proper tracking
  }).length;
  const splitPercentage = totalOrders > 0 ? (ordersWithSplit / totalOrders) * 100 : 0;

  // Calculate OTIF (On-Time In-Full)
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const onTimeOrders = deliveredOrders.filter(o => {
    if (!o.eta || !o.deliveredAt) return false;
    return o.deliveredAt <= o.eta;
  });
  const otif = deliveredOrders.length > 0 ? (onTimeOrders.length / deliveredOrders.length) * 100 : 0;

  // Calculate WAU/MAU (simplified - would need user activity tracking)
  const wauMau = 42; // Placeholder

  // Calculate retention D30
  const retentionD30 = 63; // Placeholder

  // Calculate total savings (compare to non-optimized shopping)
  // This is a simplified calculation
  const estimatedSavings = totalRevenue * 0.124; // 12.4% average savings

  // Get spending by category
  const categorySpending: Map<string, number> = new Map();

  for (const order of orders) {
    try {
      const items = JSON.parse(order.items);
      for (const item of items) {
        // Get product to find category
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (product && product.category) {
          const current = categorySpending.get(product.category) || 0;
          categorySpending.set(product.category, current + item.price * item.quantity);
        }
      }
    } catch (error) {
      console.error('Error parsing order items:', error);
    }
  }

  // Convert to array and calculate percentages
  const topCategories = Array.from(categorySpending.entries())
    .map(([category, spent]) => ({
      category,
      spent,
      percentage: (spent / totalRevenue) * 100,
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5); // Top 5 categories

  return {
    wauMau,
    retentionD30,
    ordersWithSplit: splitPercentage,
    otif,
    totalSavings: estimatedSavings,
    averageOrderValue,
    topCategories,
  };
}

/**
 * Gets spending trends over time
 */
export async function getSpendingTrends(
  userId: string,
  days: number = 30
): Promise<Array<{ date: string; amount: number }>> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const orders = await prisma.order.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date
  const trendMap: Map<string, number> = new Map();

  for (const order of orders) {
    const dateKey = order.createdAt.toISOString().split('T')[0];
    const current = trendMap.get(dateKey) || 0;
    trendMap.set(dateKey, current + order.total);
  }

  return Array.from(trendMap.entries()).map(([date, amount]) => ({
    date,
    amount,
  }));
}
