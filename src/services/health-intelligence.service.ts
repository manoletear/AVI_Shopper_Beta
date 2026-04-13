import { prisma } from '@/lib/prisma';

// ============================================
// TIPOS
// ============================================

export interface HealthAlert {
  type: 'sugar' | 'fat' | 'sodium' | 'ultra_processed' | 'allergy' | 'low_fiber' | 'low_protein';
  severity: 'info' | 'warn' | 'critical';
  title: string;
  message: string;
  products: string[];         // nombres de productos problematicos
  alternatives: Alternative[];
}

export interface Alternative {
  currentProduct: string;
  suggestedProduct: string;
  reason: string;
  nutritionBenefit: string;   // ej: "-60% azucar"
}

export interface ConsumptionPrediction {
  product: string;
  category: string;
  avgQuantityPerWeek: number;
  nextPurchaseDate: string;   // ISO date estimada
  confidence: number;         // 0-1
}

export interface HealthReport {
  overallScore: number;
  alerts: HealthAlert[];
  predictions: ConsumptionPrediction[];
  weeklyTrend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
}

// ============================================
// LIMITES DIARIOS RECOMENDADOS (adulto promedio)
// ============================================

const DAILY_LIMITS = {
  sugar: 25,        // gramos (OMS)
  fat: 65,          // gramos
  sodium: 2000,     // mg
  calories: 2000,
  fiber: 25,        // gramos minimo
  protein: 50,      // gramos minimo
};

// ============================================
// BASE DE ALTERNATIVAS SALUDABLES
// ============================================

const HEALTHY_ALTERNATIVES: Array<{
  pattern: RegExp;
  category: string;
  issue: 'sugar' | 'fat' | 'sodium' | 'ultra_processed';
  alternative: string;
  reason: string;
  benefit: string;
}> = [
  // Bebidas azucaradas
  { pattern: /coca.cola|pepsi|fanta|sprite|bebida/i, category: 'bebidas', issue: 'sugar', alternative: 'Agua Mineral Cachantún', reason: 'Las bebidas azucaradas aportan ~27g de azúcar por porción', benefit: '-100% azúcar' },
  { pattern: /jugo.*watts|jugo.*néctar|néctar/i, category: 'bebidas', issue: 'sugar', alternative: 'Jugo natural exprimido o fruta entera', reason: 'Los jugos envasados contienen azúcar añadida', benefit: '-70% azúcar' },
  // Lácteos altos en grasa
  { pattern: /leche.*entera/i, category: 'lacteos', issue: 'fat', alternative: 'Leche Descremada Colun 1L', reason: 'Misma proteína con menos grasa saturada', benefit: '-60% grasa' },
  { pattern: /mantequilla/i, category: 'lacteos', issue: 'fat', alternative: 'Palta (grasa saludable)', reason: 'Grasas insaturadas vs saturadas', benefit: 'Grasa saludable' },
  // Ultra-procesados
  { pattern: /fideos.*instant|maruchan|cup.noodle/i, category: 'despensa', issue: 'sodium', alternative: 'Fideos Carozzi + verduras', reason: 'Los fideos instantáneos tienen >1500mg de sodio', benefit: '-80% sodio' },
  { pattern: /salchicha|vienesa|jamonada/i, category: 'carnes', issue: 'ultra_processed', alternative: 'Pechuga de Pollo o Pavo', reason: 'Los embutidos son ultra-procesados con nitritos', benefit: 'Proteína limpia' },
  { pattern: /nugget|empanizado/i, category: 'carnes', issue: 'ultra_processed', alternative: 'Pollo fresco trozado', reason: 'Menos aditivos y aceites industriales', benefit: '-50% grasa, sin aditivos' },
  // Snacks
  { pattern: /galleta|cookie|oreo/i, category: 'despensa', issue: 'sugar', alternative: 'Frutos secos o fruta deshidratada', reason: 'Alto contenido de azúcar y grasas trans', benefit: '-80% azúcar, +fibra' },
  { pattern: /papa.*frita|chip|doritos|cheetos/i, category: 'despensa', issue: 'fat', alternative: 'Frutos secos sin sal', reason: 'Grasas trans y exceso de sodio', benefit: 'Grasas saludables, -70% sodio' },
  // Panaderia
  { pattern: /pan.*molde.*blanco|pan.*blanco/i, category: 'panaderia', issue: 'sugar', alternative: 'Pan Integral Bimbo 680g', reason: 'Pan blanco tiene alto índice glucémico', benefit: '+300% fibra' },
  // Azúcar directa
  { pattern: /azúcar|azucar/i, category: 'despensa', issue: 'sugar', alternative: 'Stevia o endulzante natural', reason: 'Reducir azúcar libre directa', benefit: '-100% calorías vacías' },
  // Arroz
  { pattern: /arroz.*blanco|arroz.*grado/i, category: 'despensa', issue: 'sugar', alternative: 'Arroz integral', reason: 'Menor índice glucémico y más fibra', benefit: '+400% fibra' },
];

// ============================================
// ALERGENOS COMUNES
// ============================================

const ALLERGEN_MAP: Record<string, RegExp[]> = {
  gluten: [/pan|fideos|galleta|harina|trigo|avena|cebada|centeno|pasta|marraqueta|molde/i],
  lactosa: [/leche|queso|yogurt|mantequilla|crema|helado|manjar/i],
  frutos_secos: [/nuez|almendra|maní|avellana|pistacho|castaña/i],
  mariscos: [/camarón|langostino|jaiba|cholga|chorito|almeja|ostra/i],
  huevo: [/huevo|mayonesa/i],
  soya: [/soya|soja|tofu|edamame/i],
};

// ============================================
// SERVICIO PRINCIPAL
// ============================================

/**
 * Analiza una lista de productos y genera alertas de salud
 */
export function analyzeProductsHealth(
  products: Array<{ name: string; sugar?: number; fat?: number; sodium?: number; calories?: number; fiber?: number; protein?: number; isUltraProcessed?: boolean }>,
  userAllergies: string[] = []
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  // 1. Detectar productos con exceso de azucar
  const highSugarProducts = products.filter((p) => p.sugar && p.sugar > DAILY_LIMITS.sugar * 0.3);
  if (highSugarProducts.length > 0) {
    const alternatives = findAlternatives(highSugarProducts.map((p) => p.name), 'sugar');
    alerts.push({
      type: 'sugar',
      severity: highSugarProducts.length > 3 ? 'critical' : 'warn',
      title: 'Exceso de azúcar detectado',
      message: `${highSugarProducts.length} producto(s) en tu lista tienen alto contenido de azúcar. La OMS recomienda máximo ${DAILY_LIMITS.sugar}g diarios.`,
      products: highSugarProducts.map((p) => p.name),
      alternatives,
    });
  }

  // 2. Detectar exceso de grasa
  const highFatProducts = products.filter((p) => p.fat && p.fat > DAILY_LIMITS.fat * 0.3);
  if (highFatProducts.length > 0) {
    const alternatives = findAlternatives(highFatProducts.map((p) => p.name), 'fat');
    alerts.push({
      type: 'fat',
      severity: highFatProducts.length > 3 ? 'critical' : 'warn',
      title: 'Alto contenido de grasa',
      message: `${highFatProducts.length} producto(s) con grasa elevada. Prioriza grasas saludables (palta, aceite de oliva, frutos secos).`,
      products: highFatProducts.map((p) => p.name),
      alternatives,
    });
  }

  // 3. Detectar exceso de sodio
  const highSodiumProducts = products.filter((p) => p.sodium && p.sodium > DAILY_LIMITS.sodium * 0.25);
  if (highSodiumProducts.length > 0) {
    const alternatives = findAlternatives(highSodiumProducts.map((p) => p.name), 'sodium');
    alerts.push({
      type: 'sodium',
      severity: 'warn',
      title: 'Alto contenido de sodio',
      message: `Cuidado con el sodio: ${highSodiumProducts.length} producto(s) superan el 25% del límite diario recomendado.`,
      products: highSodiumProducts.map((p) => p.name),
      alternatives,
    });
  }

  // 4. Ultra-procesados
  const ultraProcessed = products.filter((p) => p.isUltraProcessed);
  if (ultraProcessed.length > 0) {
    const pct = Math.round((ultraProcessed.length / products.length) * 100);
    const alternatives = findAlternatives(ultraProcessed.map((p) => p.name), 'ultra_processed');
    alerts.push({
      type: 'ultra_processed',
      severity: pct > 30 ? 'critical' : pct > 15 ? 'warn' : 'info',
      title: `${pct}% de ultra-procesados en tu carrito`,
      message: `Tienes ${ultraProcessed.length} productos ultra-procesados. Se recomienda que no superen el 15% de tu compra.`,
      products: ultraProcessed.map((p) => p.name),
      alternatives,
    });
  }

  // 5. Alergias
  for (const allergy of userAllergies) {
    const patterns = ALLERGEN_MAP[allergy];
    if (!patterns) continue;

    const dangerousProducts = products.filter((p) =>
      patterns.some((regex) => regex.test(p.name))
    );

    if (dangerousProducts.length > 0) {
      alerts.push({
        type: 'allergy',
        severity: 'critical',
        title: `⚠️ Alérgeno detectado: ${allergy}`,
        message: `${dangerousProducts.length} producto(s) pueden contener ${allergy}. Verifica las etiquetas antes de consumir.`,
        products: dangerousProducts.map((p) => p.name),
        alternatives: [],
      });
    }
  }

  // 6. Baja fibra
  const totalFiber = products.reduce((sum, p) => sum + (p.fiber || 0), 0);
  if (totalFiber < DAILY_LIMITS.fiber * 3 && products.length > 5) {
    alerts.push({
      type: 'low_fiber',
      severity: 'info',
      title: 'Poca fibra en tu compra',
      message: 'Considera agregar legumbres, frutas con cáscara, avena o pan integral para aumentar tu consumo de fibra.',
      products: [],
      alternatives: [],
    });
  }

  // 7. Baja proteina
  const totalProtein = products.reduce((sum, p) => sum + (p.protein || 0), 0);
  if (totalProtein < DAILY_LIMITS.protein * 3 && products.length > 5) {
    alerts.push({
      type: 'low_protein',
      severity: 'info',
      title: 'Proteína insuficiente',
      message: 'Tu compra tiene poca proteína. Agrega pollo, pescado, huevos, legumbres o lácteos.',
      products: [],
      alternatives: [],
    });
  }

  return alerts;
}

/**
 * Busca alternativas saludables para productos problematicos
 */
function findAlternatives(
  productNames: string[],
  issue: 'sugar' | 'fat' | 'sodium' | 'ultra_processed'
): Alternative[] {
  const alternatives: Alternative[] = [];

  for (const name of productNames) {
    const match = HEALTHY_ALTERNATIVES.find(
      (alt) => alt.issue === issue && alt.pattern.test(name)
    );
    if (match) {
      alternatives.push({
        currentProduct: name,
        suggestedProduct: match.alternative,
        reason: match.reason,
        nutritionBenefit: match.benefit,
      });
    }
  }

  return alternatives;
}

/**
 * Predice consumo futuro basado en historial de compras
 */
export async function predictConsumption(
  userId: string
): Promise<ConsumptionPrediction[]> {
  // Obtener ordenes de los ultimos 90 dias
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const orders = await prisma.order.findMany({
    where: {
      userId,
      status: 'delivered',
      createdAt: { gte: ninetyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (orders.length === 0) return [];

  // Parsear items de todas las ordenes
  const productFrequency: Map<string, { count: number; totalQty: number; lastPurchase: Date; category: string }> = new Map();

  for (const order of orders) {
    let items: Array<{ name: string; quantity: number; productId?: string }>;
    try {
      items = JSON.parse(order.items);
    } catch {
      continue;
    }

    for (const item of items) {
      const key = item.name;
      const existing = productFrequency.get(key) || {
        count: 0,
        totalQty: 0,
        lastPurchase: order.createdAt,
        category: '',
      };

      existing.count++;
      existing.totalQty += item.quantity || 1;
      if (order.createdAt > existing.lastPurchase) {
        existing.lastPurchase = order.createdAt;
      }

      productFrequency.set(key, existing);
    }
  }

  // Calcular predicciones
  const predictions: ConsumptionPrediction[] = [];
  const totalWeeks = 90 / 7;

  for (const [product, data] of productFrequency) {
    if (data.count < 2) continue; // necesitamos al menos 2 compras para predecir

    const avgPerWeek = data.totalQty / totalWeeks;
    const avgDaysBetween = 90 / data.count;

    // Estimar proxima compra
    const daysSinceLast = Math.floor(
      (Date.now() - data.lastPurchase.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilNext = Math.max(0, Math.round(avgDaysBetween - daysSinceLast));
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysUntilNext);

    // Confianza basada en regularidad
    const confidence = Math.min(0.95, data.count / totalWeeks);

    predictions.push({
      product,
      category: data.category,
      avgQuantityPerWeek: Number(avgPerWeek.toFixed(1)),
      nextPurchaseDate: nextDate.toISOString().split('T')[0],
      confidence: Number(confidence.toFixed(2)),
    });
  }

  // Ordenar por proximidad de proxima compra
  return predictions.sort(
    (a, b) => new Date(a.nextPurchaseDate).getTime() - new Date(b.nextPurchaseDate).getTime()
  );
}

/**
 * Genera reporte completo de salud para un usuario
 */
export async function generateHealthReport(
  userId: string,
  currentProducts: Array<{ name: string; sugar?: number; fat?: number; sodium?: number; calories?: number; fiber?: number; protein?: number; isUltraProcessed?: boolean }>
): Promise<HealthReport> {
  // Obtener alergias del usuario
  const preferences = await prisma.userPreference.findUnique({
    where: { userId },
  });

  let allergies: string[] = [];
  if (preferences?.allergies) {
    try {
      allergies = JSON.parse(preferences.allergies);
    } catch {
      allergies = [];
    }
  }

  // Analizar productos actuales
  const alerts = analyzeProductsHealth(currentProducts, allergies);

  // Predecir consumo futuro
  const predictions = await predictConsumption(userId);

  // Calcular score general
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warnCount = alerts.filter((a) => a.severity === 'warn').length;
  const overallScore = Math.max(0, 100 - criticalCount * 20 - warnCount * 10);

  // Determinar tendencia
  const nutritionData = await prisma.nutritionData.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 14, // ultimas 2 semanas
  });

  let weeklyTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (nutritionData.length >= 7) {
    const recent = nutritionData.slice(0, 7);
    const previous = nutritionData.slice(7);
    const recentAvg = recent.reduce((s, d) => s + d.score, 0) / recent.length;
    const prevAvg = previous.length > 0
      ? previous.reduce((s, d) => s + d.score, 0) / previous.length
      : recentAvg;

    if (recentAvg - prevAvg > 5) weeklyTrend = 'improving';
    else if (prevAvg - recentAvg > 5) weeklyTrend = 'declining';
  }

  // Generar recomendaciones
  const recommendations: string[] = [];
  if (alerts.some((a) => a.type === 'sugar')) {
    recommendations.push('Reemplaza bebidas azucaradas por agua, infusiones o jugos naturales.');
  }
  if (alerts.some((a) => a.type === 'fat')) {
    recommendations.push('Prefiere grasas saludables: palta, aceite de oliva, frutos secos.');
  }
  if (alerts.some((a) => a.type === 'ultra_processed')) {
    recommendations.push('Reduce ultra-procesados: cocina más con ingredientes frescos.');
  }
  if (alerts.some((a) => a.type === 'low_fiber')) {
    recommendations.push('Agrega legumbres 2-3 veces por semana y prefiere pan integral.');
  }
  if (alerts.some((a) => a.type === 'allergy')) {
    recommendations.push('Revisa siempre las etiquetas — algunos alérgenos aparecen como trazas.');
  }
  if (predictions.length > 0) {
    const urgent = predictions.filter(
      (p) => new Date(p.nextPurchaseDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    );
    if (urgent.length > 0) {
      recommendations.push(
        `Próximos a acabarse: ${urgent.map((p) => p.product).join(', ')}. Considera agregarlos a tu lista.`
      );
    }
  }

  return {
    overallScore,
    alerts,
    predictions,
    weeklyTrend,
    recommendations,
  };
}
