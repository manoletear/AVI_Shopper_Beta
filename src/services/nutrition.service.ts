import { prisma } from '@/lib/prisma';
import { NutritionSummary } from '@/types';

/**
 * Calculates nutrition score (0-100) based on food quality
 */
export function calculateNutritionScore(
  ultraProcessedPercentage: number,
  fruitServings: number,
  proteinGrams: number,
  totalCalories: number
): number {
  let score = 100;

  // Penalize ultra-processed foods (max -40 points)
  score -= Math.min(40, ultraProcessedPercentage * 2);

  // Reward fruit consumption (up to +20 points)
  const fruitBonus = Math.min(20, fruitServings * 2);
  score += fruitBonus;

  // Reward adequate protein (up to +10 points)
  const proteinRatio = proteinGrams / (totalCalories / 4); // Target ~25% protein
  const proteinBonus = Math.min(10, proteinRatio * 40);
  score += proteinBonus;

  // Penalize excessive calories (based on 2000 cal/day standard)
  const dailyCalories = totalCalories / 7; // Assuming weekly data
  if (dailyCalories > 2500) {
    score -= Math.min(10, (dailyCalories - 2500) / 100);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Analyzes nutrition data for a shopping list
 */
export async function analyzeShoppingListNutrition(
  shoppingListId: string
): Promise<NutritionSummary> {
  const shoppingList = await prisma.shoppingList.findUnique({
    where: { id: shoppingListId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!shoppingList) {
    throw new Error('Shopping list not found');
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let ultraProcessedCount = 0;
  let fruitServings = 0;
  let totalItems = 0;

  for (const item of shoppingList.items) {
    if (!item.product) continue;

    const qty = item.quantity;
    totalItems += qty;

    if (item.product.calories) {
      totalCalories += item.product.calories * qty;
    }

    if (item.product.protein) {
      totalProtein += item.product.protein * qty;
    }

    if (item.product.isUltraProcessed) {
      ultraProcessedCount += qty;
    }

    // Count fruits based on category
    if (item.product.category?.toLowerCase().includes('fruta')) {
      fruitServings += qty;
    }
  }

  const ultraProcessedPercentage = totalItems > 0 ? (ultraProcessedCount / totalItems) * 100 : 0;

  const score = calculateNutritionScore(
    ultraProcessedPercentage,
    fruitServings,
    totalProtein,
    totalCalories
  );

  return {
    score,
    ultraProcessedPercentage,
    fruitServings,
    proteinGrams: totalProtein,
    totalCalories,
  };
}

/**
 * Gets nutrition summary for a user over a date range
 */
export async function getUserNutritionSummary(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<NutritionSummary> {
  const nutritionData = await prisma.nutritionData.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'desc' },
  });

  if (nutritionData.length === 0) {
    return {
      score: 0,
      ultraProcessedPercentage: 0,
      fruitServings: 0,
      proteinGrams: 0,
      totalCalories: 0,
    };
  }

  // Calculate averages
  const avgScore =
    nutritionData.reduce((sum, d) => sum + d.score, 0) / nutritionData.length;
  const avgUltraProcessed =
    nutritionData.reduce((sum, d) => sum + d.ultraProcessed, 0) / nutritionData.length;
  const totalFruits = nutritionData.reduce((sum, d) => sum + d.fruits, 0);
  const totalProtein = nutritionData.reduce((sum, d) => sum + d.protein, 0);
  const totalCals = nutritionData.reduce((sum, d) => sum + d.calories, 0);

  // Calculate trend (compare to previous period)
  const periodLength = endDate.getTime() - startDate.getTime();
  const previousStart = new Date(startDate.getTime() - periodLength);
  const previousData = await prisma.nutritionData.findMany({
    where: {
      userId,
      date: {
        gte: previousStart,
        lt: startDate,
      },
    },
  });

  let trend;
  if (previousData.length > 0) {
    const prevAvgScore =
      previousData.reduce((sum, d) => sum + d.score, 0) / previousData.length;
    const prevAvgUltraProcessed =
      previousData.reduce((sum, d) => sum + d.ultraProcessed, 0) / previousData.length;

    trend = {
      scoreDiff: Math.round(avgScore - prevAvgScore),
      ultraProcessedDiff: Number((avgUltraProcessed - prevAvgUltraProcessed).toFixed(1)),
    };
  }

  return {
    score: Math.round(avgScore),
    ultraProcessedPercentage: Number(avgUltraProcessed.toFixed(1)),
    fruitServings: totalFruits,
    proteinGrams: Number(totalProtein.toFixed(1)),
    totalCalories: Number(totalCals.toFixed(0)),
    trend,
  };
}
