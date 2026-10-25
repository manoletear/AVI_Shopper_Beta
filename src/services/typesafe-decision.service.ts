/**
 * TypeSafe Decision Service
 *
 * Usa TypeSafe (api.typesafe.ai) para decisiones inteligentes:
 * - Matching de productos entre tiendas
 * - Evaluacion de salud de productos
 * - Seleccion de sustituciones
 * - Clasificacion de urgencia de compra
 * - Deteccion de alergenos
 */

const TYPESAFE_API = 'https://api.typesafe.ai/v1/systemone';

interface TypeSafeQuestion {
  type: 'choice' | 'noul' | 'score';
  instructions: string;
  criteria: Record<string, string> | string[];
}

interface TypeSafeRequest {
  state: string | Record<string, unknown>;
  model: string;
  questions: Record<string, TypeSafeQuestion>;
}

interface TypeSafeAnswer {
  type: string;
  choice?: string;
  noul?: number;
  score?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
}

interface TypeSafeResponse {
  model: string;
  answers: Record<string, TypeSafeAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

async function callTypeSafe(
  request: TypeSafeRequest,
  apiKey: string
): Promise<TypeSafeResponse> {
  const res = await fetch(TYPESAFE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TypeSafe error ${res.status}: ${text}`);
  }

  return res.json();
}

// ============================================
// PRODUCT MATCHING
// ¿Son estos dos productos el mismo item?
// ============================================

export async function matchProducts(
  productA: { name: string; brand: string; store: string },
  productB: { name: string; brand: string; store: string },
  apiKey: string
): Promise<{ isMatch: boolean; confidence: number }> {
  const response = await callTypeSafe(
    {
      state: `Producto A (${productA.store}): "${productA.name}" marca ${productA.brand}. Producto B (${productB.store}): "${productB.name}" marca ${productB.brand}.`,
      model: 'jev-latest',
      questions: {
        is_same: {
          type: 'noul',
          instructions: '¿Son estos dos productos esencialmente el mismo item (mismo producto, misma marca, mismo tamaño/peso)?',
          criteria: {
            true: 'Mismo producto, marca y presentación',
            false: 'Productos diferentes o presentaciones distintas',
          },
        },
      },
    },
    apiKey
  );

  const same = response.answers.is_same;
  const noul = same?.noul ?? 0;
  return {
    isMatch: noul > 0.7,
    confidence: noul,
  };
}

// ============================================
// HEALTH SCORE
// ¿Qué tan saludable es este producto?
// ============================================

export async function scoreProductHealth(
  product: { name: string; brand: string; category?: string },
  apiKey: string
): Promise<{
  healthLevel: string;
  score: number;
  isUltraProcessed: boolean;
  confidence: number;
}> {
  const response = await callTypeSafe(
    {
      state: `Producto: "${product.name}" marca ${product.brand}, categoría: ${product.category || 'desconocida'}`,
      model: 'jev-latest',
      questions: {
        health: {
          type: 'score',
          instructions: '¿Qué tan saludable es este producto alimenticio para consumo regular?',
          criteria: [
            'Muy saludable - alimento fresco, natural, sin procesar',
            'Saludable - mínimamente procesado, buena nutrición',
            'Moderado - procesado pero aceptable con moderación',
            'Poco saludable - ultra-procesado, alto en azúcar/grasa/sodio',
            'No saludable - ultra-procesado, sin valor nutricional significativo',
          ],
        },
        ultra_processed: {
          type: 'noul',
          instructions: '¿Es este un producto ultra-procesado según la clasificación NOVA?',
          criteria: {
            true: 'Ultra-procesado (NOVA grupo 4): contiene ingredientes industriales, aditivos, emulsificantes',
            false: 'No ultra-procesado: alimento fresco, mínimamente procesado o ingrediente culinario',
          },
        },
      },
    },
    apiKey
  );

  const health = response.answers.health;
  const ultra = response.answers.ultra_processed;
  const healthScore = health?.score ?? 2;
  const levels = [
    'Muy saludable',
    'Saludable',
    'Moderado',
    'Poco saludable',
    'No saludable',
  ];

  return {
    healthLevel: levels[Math.round(healthScore)] || 'Moderado',
    score: Math.round((1 - healthScore / 4) * 100),
    isUltraProcessed: (ultra?.noul ?? 0) > 0.6,
    confidence: health?.confidence ?? 0,
  };
}

// ============================================
// SUBSTITUTION SELECTION
// ¿Cuál es la mejor alternativa?
// ============================================

export async function selectSubstitution(
  original: { name: string; reason: string },
  candidates: Array<{ name: string; price: number }>,
  apiKey: string
): Promise<{
  selected: string;
  confidence: number;
  probabilities: Record<string, number>;
}> {
  const criteria: Record<string, string> = {};
  candidates.forEach((c) => {
    criteria[c.name] = `$${c.price.toLocaleString('es-CL')} - alternativa disponible`;
  });

  const response = await callTypeSafe(
    {
      state: `El usuario busca "${original.name}". Razón de sustitución: ${original.reason}. Necesita la alternativa más similar en calidad y precio.`,
      model: 'jev-latest',
      questions: {
        best_alternative: {
          type: 'choice',
          instructions: '¿Cuál es la mejor alternativa para reemplazar el producto original?',
          criteria,
        },
      },
    },
    apiKey
  );

  return {
    selected: response.answers.best_alternative?.choice ?? candidates[0]?.name ?? '',
    confidence: response.answers.best_alternative?.confidence ?? 0,
    probabilities: response.answers.best_alternative?.probabilities ?? {},
  };
}

// ============================================
// ALLERGY DETECTION
// ¿Contiene este producto un alérgeno?
// ============================================

export async function detectAllergen(
  product: { name: string; brand: string; ingredients?: string },
  allergen: string,
  apiKey: string
): Promise<{ probability: number; isSafe: boolean }> {
  const response = await callTypeSafe(
    {
      state: `Producto: "${product.name}" marca ${product.brand}. ${product.ingredients ? `Ingredientes: ${product.ingredients}` : ''}`,
      model: 'jev-latest',
      questions: {
        contains_allergen: {
          type: 'noul',
          instructions: `¿Es probable que este producto contenga o esté en contacto con ${allergen}?`,
          criteria: {
            true: `Contiene ${allergen} o puede contener trazas`,
            false: `No contiene ${allergen} ni tiene riesgo de contaminación cruzada`,
          },
        },
      },
    },
    apiKey
  );

  const prob = response.answers.contains_allergen?.noul ?? 0.5;
  return {
    probability: prob,
    isSafe: prob < 0.3,
  };
}

// ============================================
// PURCHASE URGENCY
// ¿Qué tan urgente es comprar este producto?
// ============================================

export async function assessUrgency(
  product: { name: string; category: string; lastPurchaseDaysAgo: number; avgConsumptionDays: number },
  apiKey: string
): Promise<{ urgency: string; score: number }> {
  const response = await callTypeSafe(
    {
      state: `Producto: "${product.name}", categoría: ${product.category}. Última compra hace ${product.lastPurchaseDaysAgo} días. Consumo promedio cada ${product.avgConsumptionDays} días.`,
      model: 'jev-latest',
      questions: {
        urgency: {
          type: 'score',
          instructions: '¿Qué tan urgente es reabastecer este producto?',
          criteria: [
            'No urgente - quedan varios días de stock',
            'Pronto - comprar en los próximos días',
            'Urgente - probablemente ya se acabó',
          ],
        },
      },
    },
    apiKey
  );

  const score = response.answers.urgency?.score ?? 0;
  const levels = ['No urgente', 'Pronto', 'Urgente'];
  return {
    urgency: levels[Math.round(score)] || 'Pronto',
    score,
  };
}

// ============================================
// BATCH ANALYSIS
// Analiza múltiples productos de una vez
// ============================================

export async function analyzeCart(
  products: Array<{ name: string; brand: string; category?: string }>,
  apiKey: string
): Promise<
  Array<{
    name: string;
    healthLevel: string;
    healthScore: number;
    isUltraProcessed: boolean;
  }>
> {
  const results = [];

  for (const product of products) {
    try {
      const health = await scoreProductHealth(product, apiKey);
      results.push({
        name: product.name,
        healthLevel: health.healthLevel,
        healthScore: health.score,
        isUltraProcessed: health.isUltraProcessed,
      });
    } catch {
      results.push({
        name: product.name,
        healthLevel: 'Desconocido',
        healthScore: 50,
        isUltraProcessed: false,
      });
    }
  }

  return results;
}
