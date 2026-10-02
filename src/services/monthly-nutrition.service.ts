/**
 * Monthly Nutrition Analysis Service
 *
 * Analiza el consumo nutricional mensual de la familia basado
 * en el historial de compras y datos de Open Food Facts.
 *
 * Genera alertas cuando:
 * - Calorias mensuales superan lo recomendado
 * - Azucar acumulada esta alta
 * - Sodio acumulado esta alto
 * - % de ultra-procesados es mayor al 30%
 * - Sugerencias de cambios de habito
 */

import { prisma } from '@/lib/prisma';
import { familyWhere } from '@/lib/family';
import { lookupNutrition } from './openfoodfacts.service';

export interface MonthlyNutritionReport {
  month: string;
  familySize: number;
  totalProducts: number;
  estimatedCalories: number;
  estimatedSugar: number;       // gramos
  estimatedSodium: number;      // gramos
  estimatedFat: number;         // gramos
  estimatedProtein: number;     // gramos
  ultraProcessedCount: number;
  ultraProcessedPercent: number;
  alerts: NutritionAlert[];
  habits: HabitSuggestion[];
}

export interface NutritionAlert {
  type: 'calories' | 'sugar' | 'sodium' | 'fat' | 'ultra_processed';
  severity: 'info' | 'warn' | 'critical';
  title: string;
  message: string;
  currentValue: number;
  recommendedMax: number;
  unit: string;
}

export interface HabitSuggestion {
  title: string;
  description: string;
  impact: string;
}

// Limites mensuales recomendados por persona (30 dias)
const MONTHLY_LIMITS_PER_PERSON = {
  calories: 2000 * 30,         // 60,000 kcal/mes
  sugar: 25 * 30,              // 750g/mes (OMS)
  sodium: 2 * 30,              // 60g/mes
  fat: 65 * 30,                // 1,950g/mes
  ultraProcessedPercent: 30,   // maximo 30% del total
};

export async function generateMonthlyReport(
  userId: string
): Promise<MonthlyNutritionReport> {
  const fw = await familyWhere(userId);

  // Obtener compras del mes actual
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const month = now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

  const purchases = await prisma.purchaseHistory.findMany({
    where: {
      ...fw,
      purchasedAt: { gte: monthStart },
    },
  });

  // Obtener items de listas completados este mes
  const checkedItems = await prisma.shoppingItem.findMany({
    where: {
      shoppingList: fw,
      checked: true,
      updatedAt: { gte: monthStart },
    },
  });

  // Combinar todos los productos
  const allProducts = [
    ...purchases.map((p) => ({ name: p.productName, quantity: p.quantity })),
    ...checkedItems.map((i) => ({ name: i.name, quantity: i.quantity })),
  ];

  // Deduplicar
  const uniqueProducts = new Map<string, number>();
  for (const p of allProducts) {
    const key = p.name.toLowerCase();
    uniqueProducts.set(key, (uniqueProducts.get(key) || 0) + p.quantity);
  }

  // Estimar nutricion con Open Food Facts (maximo 15 para no saturar API)
  let totalCalories = 0;
  let totalSugar = 0;
  let totalSodium = 0;
  let totalFat = 0;
  let totalProtein = 0;
  let ultraProcessedCount = 0;
  let analyzedCount = 0;

  const productEntries = [...uniqueProducts.entries()].slice(0, 15);

  for (const [name, qty] of productEntries) {
    try {
      const nutrition = await lookupNutrition(name);
      if (nutrition) {
        totalCalories += nutrition.calories * qty;
        totalSugar += nutrition.sugars * qty;
        totalSodium += nutrition.sodium * qty;
        totalFat += nutrition.fat * qty;
        totalProtein += nutrition.proteins * qty;
        if (nutrition.isUltraProcessed) ultraProcessedCount += qty;
        analyzedCount += qty;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }

  const totalItems = [...uniqueProducts.values()].reduce((s, q) => s + q, 0);
  const ultraProcessedPercent = totalItems > 0 ? Math.round((ultraProcessedCount / totalItems) * 100) : 0;

  // Contar miembros de la familia
  const familyMembership = await prisma.familyMember.findFirst({
    where: { userId },
    include: { family: { include: { members: { where: { isActive: true, type: 'person' } } } } },
  });
  const familySize = familyMembership?.family?.members?.length || 1;

  // Limites ajustados por tamaño de familia
  const limits = {
    calories: MONTHLY_LIMITS_PER_PERSON.calories * familySize,
    sugar: MONTHLY_LIMITS_PER_PERSON.sugar * familySize,
    sodium: MONTHLY_LIMITS_PER_PERSON.sodium * familySize,
    fat: MONTHLY_LIMITS_PER_PERSON.fat * familySize,
  };

  // Generar alertas
  const alerts: NutritionAlert[] = [];

  if (totalCalories > limits.calories * 0.8) {
    alerts.push({
      type: 'calories',
      severity: totalCalories > limits.calories ? 'critical' : 'warn',
      title: 'Calorias altas este mes',
      message: `Tu familia lleva ~${Math.round(totalCalories).toLocaleString('es-CL')} kcal este mes. Lo recomendado para ${familySize} persona${familySize > 1 ? 's' : ''} es ${limits.calories.toLocaleString('es-CL')} kcal.`,
      currentValue: Math.round(totalCalories),
      recommendedMax: limits.calories,
      unit: 'kcal',
    });
  }

  if (totalSugar > limits.sugar * 0.8) {
    alerts.push({
      type: 'sugar',
      severity: totalSugar > limits.sugar ? 'critical' : 'warn',
      title: 'Azucar acumulada alta',
      message: `Llevan ~${Math.round(totalSugar)}g de azucar este mes. La OMS recomienda maximo ${limits.sugar}g para ${familySize} persona${familySize > 1 ? 's' : ''}.`,
      currentValue: Math.round(totalSugar),
      recommendedMax: limits.sugar,
      unit: 'g',
    });
  }

  if (totalSodium > limits.sodium * 0.8) {
    alerts.push({
      type: 'sodium',
      severity: totalSodium > limits.sodium ? 'critical' : 'warn',
      title: 'Sodio acumulado alto',
      message: `Llevan ~${Math.round(totalSodium)}g de sodio. Cuidado con la presion arterial.`,
      currentValue: Math.round(totalSodium),
      recommendedMax: limits.sodium,
      unit: 'g',
    });
  }

  if (ultraProcessedPercent > MONTHLY_LIMITS_PER_PERSON.ultraProcessedPercent) {
    alerts.push({
      type: 'ultra_processed',
      severity: ultraProcessedPercent > 50 ? 'critical' : 'warn',
      title: `${ultraProcessedPercent}% de ultra-procesados`,
      message: `${ultraProcessedCount} de ${totalItems} productos son ultra-procesados. Lo ideal es menos del 30%.`,
      currentValue: ultraProcessedPercent,
      recommendedMax: 30,
      unit: '%',
    });
  }

  // Sugerencias de habito
  const habits: HabitSuggestion[] = [];

  if (totalSugar > limits.sugar * 0.5) {
    habits.push({
      title: 'Reducir bebidas azucaradas',
      description: 'Reemplaza gaseosas por agua mineral o jugos naturales sin azucar añadida.',
      impact: 'Puede reducir hasta 40% del azucar mensual',
    });
  }

  if (ultraProcessedPercent > 20) {
    habits.push({
      title: 'Cocinar mas con ingredientes frescos',
      description: 'Reemplaza snacks y comida preparada por frutas, verduras y legumbres.',
      impact: 'Mejora score nutricional y reduce sodio',
    });
  }

  if (totalProtein < MONTHLY_LIMITS_PER_PERSON.calories * familySize * 0.001) {
    habits.push({
      title: 'Agregar mas proteina',
      description: 'Incluye pollo, pescado, huevos o legumbres en mas comidas.',
      impact: 'Mejor saciedad y nutricion balanceada',
    });
  }

  return {
    month,
    familySize,
    totalProducts: totalItems,
    estimatedCalories: Math.round(totalCalories),
    estimatedSugar: Math.round(totalSugar),
    estimatedSodium: Math.round(totalSodium * 10) / 10,
    estimatedFat: Math.round(totalFat),
    estimatedProtein: Math.round(totalProtein),
    ultraProcessedCount,
    ultraProcessedPercent,
    alerts,
    habits,
  };
}
