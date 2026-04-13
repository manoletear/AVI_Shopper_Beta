import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/responses';
import type { AgentId, ChatMessage } from '@/types';

// ============================================
// INTENT DETECTION (NLU simplificado)
// ============================================

interface DetectedIntent {
  intent: string;
  agent: AgentId;
  confidence: number;
  entities: Record<string, string>;
}

const INTENT_PATTERNS: Array<{
  patterns: RegExp[];
  intent: string;
  agent: AgentId;
}> = [
  // Shopping Agent
  {
    patterns: [
      /\b(lista|agreg|añad|quiero comprar|necesito|agregar|agrega|pon|añade)\b/i,
      /\b(comprar|compras|supermercado|productos|producto)\b/i,
      /\b(quitar|eliminar|borrar|sacar) .*(lista|producto|item)/i,
    ],
    intent: 'manage_list',
    agent: 'shopping',
  },
  // Pricing Agent
  {
    patterns: [
      /\b(precio|precios|cuesta|cuestan|cuánto|barato|caro|oferta|ofertas|descuento)\b/i,
      /\b(comparar|compara|comparación|mejor precio|más barato)\b/i,
      /\b(dónde.*más barato|dónde.*mejor precio|ahorro|ahorrar)\b/i,
    ],
    intent: 'compare_prices',
    agent: 'pricing',
  },
  // Nutrition Agent
  {
    patterns: [
      /\b(nutrición|nutricional|calorías|proteína|saludable|sano|orgánico)\b/i,
      /\b(ultra.?procesado|sin gluten|vegano|vegetariano|keto|dieta)\b/i,
      /\b(alergia|alergias|alérgico|intolerancia|sin lactosa)\b/i,
    ],
    intent: 'nutrition_check',
    agent: 'nutrition',
  },
  // Budget Agent
  {
    patterns: [
      /\b(presupuesto|gasto|gastos|plata|dinero|mensual|semanal)\b/i,
      /\b(cuánto.*gastado|cuánto.*llevo|cuánto.*queda)\b/i,
      /\b(límite|limitar|ajustar.*presupuesto)\b/i,
    ],
    intent: 'budget_check',
    agent: 'budget',
  },
  // Account Agent
  {
    patterns: [
      /\b(cuenta|cuentas|vincular|desvincular|supermercado.*cuenta)\b/i,
      /\b(tarjeta.*fidelidad|puntos|membresía)\b/i,
      /\b(crear cuenta|registrar.*tienda|login.*tienda)\b/i,
    ],
    intent: 'manage_account',
    agent: 'account',
  },
  // Delivery Agent
  {
    patterns: [
      /\b(pedido|pedidos|entreg|despacho|envío|llega|llegan)\b/i,
      /\b(pedir|ordenar|confirmar.*compra|comprar.*ahora)\b/i,
      /\b(estado.*pedido|tracking|seguimiento|dónde.*pedido)\b/i,
    ],
    intent: 'delivery',
    agent: 'delivery',
  },
];

function detectIntent(message: string): DetectedIntent {
  for (const rule of INTENT_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        return {
          intent: rule.intent,
          agent: rule.agent,
          confidence: 0.85,
          entities: extractEntities(message, rule.intent),
        };
      }
    }
  }

  return {
    intent: 'general',
    agent: 'orchestrator',
    confidence: 0.5,
    entities: {},
  };
}

function extractEntities(message: string, intent: string): Record<string, string> {
  const entities: Record<string, string> = {};

  // Extraer números (cantidades, precios, presupuesto)
  const numbers = message.match(/\$?\d[\d.,]*/g);
  if (numbers) {
    if (intent === 'budget_check') {
      entities.amount = numbers[0].replace(/[$.,]/g, '');
    } else {
      entities.quantity = numbers[0];
    }
  }

  // Extraer nombres de tiendas
  const stores = ['jumbo', 'líder', 'lider', 'santa isabel', 'unimarc'];
  for (const store of stores) {
    if (message.toLowerCase().includes(store)) {
      entities.store = store;
    }
  }

  return entities;
}

// ============================================
// AGENT RESPONSES (simulado)
// ============================================

const PRODUCT_DB = [
  { name: 'Leche Entera Soprole 1L', price: 1250, category: 'lacteos' },
  { name: 'Pan de Molde Ideal 500g', price: 2650, category: 'panaderia' },
  { name: 'Manzanas Red Delicious 1kg', price: 1890, category: 'frutas' },
  { name: 'Pechuga de Pollo 1kg', price: 4890, category: 'carnes' },
  { name: 'Arroz Tucapel 1kg', price: 1380, category: 'despensa' },
  { name: 'Coca Cola 2L', price: 2190, category: 'bebidas' },
  { name: 'Detergente Omo 3kg', price: 8950, category: 'limpieza' },
  { name: 'Plátanos 1kg', price: 1450, category: 'frutas' },
];

function generateAgentResponse(
  intent: DetectedIntent,
  message: string
): { content: string; metadata: ChatMessage['metadata'] } {
  switch (intent.agent) {
    case 'shopping': {
      const mentionedProducts = PRODUCT_DB.filter((p) =>
        message.toLowerCase().includes(p.name.split(' ')[0].toLowerCase())
      );

      if (mentionedProducts.length > 0) {
        const productList = mentionedProducts
          .map((p) => `  - ${p.name} ($${p.price.toLocaleString('es-CL')})`)
          .join('\n');
        return {
          content: `He encontrado estos productos para tu lista:\n\n${productList}\n\n¿Los agrego a tu lista familiar?`,
          metadata: {
            intent: 'manage_list',
            agentsInvolved: ['shopping', 'pricing'],
            products: mentionedProducts.map((p) => ({ name: p.name, price: p.price })),
            actionButtons: [
              { label: 'Agregar todos', action: 'add_all' },
              { label: 'Ver más opciones', action: 'show_more' },
            ],
          },
        };
      }

      return {
        content:
          '¡Claro! Puedo ayudarte con tu lista de compras. Dime qué productos necesitas y los agrego. También puedo sugerir productos basándome en tus compras anteriores.\n\n¿Qué necesitas comprar?',
        metadata: {
          intent: 'manage_list',
          agentsInvolved: ['shopping'],
          actionButtons: [
            { label: 'Ver mi lista actual', action: 'view_list' },
            { label: 'Sugerir productos', action: 'suggest' },
            { label: 'Lista de la semana', action: 'weekly_template' },
          ],
        },
      };
    }

    case 'pricing': {
      return {
        content:
          'He comparado los precios en los 4 supermercados disponibles:\n\n' +
          '🛒 **Jumbo**: $45.230\n' +
          '🏪 **Líder**: $42.890 ⭐ Más barato\n' +
          '🏬 **Santa Isabel**: $47.150\n' +
          '🏭 **Unimarc**: $43.560\n\n' +
          '💡 **Split óptimo**: Comprando en Líder + Unimarc podrías ahorrar **$3.450** adicionales.\n\n' +
          '¿Quieres que optimice tu carrito con el split por tiendas?',
        metadata: {
          intent: 'compare_prices',
          agentsInvolved: ['pricing', 'shopping'],
          savings: 3450,
          actionButtons: [
            { label: 'Aplicar split óptimo', action: 'apply_split' },
            { label: 'Comprar todo en Líder', action: 'single_store' },
            { label: 'Ver detalle por producto', action: 'price_detail' },
          ],
        },
      };
    }

    case 'nutrition': {
      return {
        content:
          '🥗 **Score Nutricional de tu carrito: 72/100**\n\n' +
          '✅ Buen balance de proteínas (pechuga de pollo)\n' +
          '✅ Incluye frutas frescas\n' +
          '⚠️ 15% de ultra-procesados detectados\n' +
          '💡 Sugerencia: Reemplaza la Coca Cola por agua mineral Cachantún y sube tu score a 81/100\n\n' +
          '¿Quieres que aplique las sustituciones saludables?',
        metadata: {
          intent: 'nutrition_check',
          agentsInvolved: ['nutrition', 'shopping'],
          actionButtons: [
            { label: 'Aplicar sustituciones', action: 'apply_substitutions' },
            { label: 'Ver detalle nutricional', action: 'nutrition_detail' },
            { label: 'Ignorar', action: 'dismiss' },
          ],
        },
      };
    }

    case 'budget': {
      const budgetAmount = intent.entities.amount
        ? parseInt(intent.entities.amount)
        : 80000;

      return {
        content:
          `📊 **Resumen de Presupuesto**\n\n` +
          `Presupuesto mensual: $${budgetAmount.toLocaleString('es-CL')}\n` +
          `Gastado este mes: $${Math.round(budgetAmount * 0.65).toLocaleString('es-CL')}\n` +
          `Disponible: $${Math.round(budgetAmount * 0.35).toLocaleString('es-CL')}\n\n` +
          `📈 Progreso: ████████████░░░░░░░░ 65%\n\n` +
          `Tu carrito actual ($43.200) cabe dentro del presupuesto restante. ¿Confirmo la compra?`,
        metadata: {
          intent: 'budget_check',
          agentsInvolved: ['budget', 'pricing'],
          actionButtons: [
            { label: 'Ajustar presupuesto', action: 'adjust_budget' },
            { label: 'Ver historial de gastos', action: 'spending_history' },
          ],
        },
      };
    }

    case 'account': {
      return {
        content:
          '🔗 **Tus cuentas de supermercado:**\n\n' +
          '✅ **Jumbo** — ana.garcia@email.com (verificada)\n' +
          '⏳ **Líder** — pendiente de verificación\n' +
          '❌ **Santa Isabel** — sin vincular\n' +
          '❌ **Unimarc** — sin vincular\n\n' +
          'Puedo crear automáticamente tus cuentas en Santa Isabel y Unimarc usando tus datos de AVI. ¿Quieres que las cree?',
        metadata: {
          intent: 'manage_account',
          agentsInvolved: ['account'],
          actionButtons: [
            { label: 'Crear cuentas faltantes', action: 'auto_create_accounts' },
            { label: 'Ir a configuración', action: 'go_settings' },
          ],
        },
      };
    }

    case 'delivery': {
      return {
        content:
          '🚚 **Estado de tus pedidos:**\n\n' +
          '📦 **Pedido #4521** — Jumbo\n' +
          '   Estado: En camino 🟢\n' +
          '   ETA: 14:30 - 15:00 hrs\n' +
          '   Items: 12 productos\n\n' +
          '📦 **Pedido #4520** — Líder\n' +
          '   Estado: Preparando 🟡\n' +
          '   ETA: 16:00 - 17:00 hrs\n' +
          '   Items: 8 productos\n\n' +
          '¿Necesitas modificar algún pedido?',
        metadata: {
          intent: 'delivery',
          agentsInvolved: ['delivery'],
          actionButtons: [
            { label: 'Ver detalle completo', action: 'order_detail' },
            { label: 'Contactar repartidor', action: 'contact_driver' },
          ],
        },
      };
    }

    default: {
      return {
        content:
          '¡Hola! Soy **AVI**, tu asistente inteligente de compras familiares. 🛒\n\n' +
          'Puedo ayudarte con:\n\n' +
          '📝 **Listas** — Crear y gestionar listas de compras familiares\n' +
          '💰 **Precios** — Comparar precios entre supermercados\n' +
          '🥗 **Nutrición** — Evaluar la calidad nutricional de tu carrito\n' +
          '📊 **Presupuesto** — Controlar tus gastos mensuales\n' +
          '🔗 **Cuentas** — Vincular tus supermercados\n' +
          '🚚 **Pedidos** — Hacer y rastrear tus compras\n\n' +
          '¿En qué te puedo ayudar?',
        metadata: {
          intent: 'general',
          agentsInvolved: ['orchestrator'],
          actionButtons: [
            { label: 'Crear lista semanal', action: 'weekly_list' },
            { label: 'Comparar precios', action: 'compare' },
            { label: 'Ver presupuesto', action: 'budget' },
          ],
        },
      };
    }
  }
}

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message || typeof message !== 'string') {
      return errorResponse('El mensaje es requerido', 400, 'VALIDATION_ERROR');
    }

    // 1. Detectar intención
    const intent = detectIntent(message);

    // 2. Generar respuesta del agente correspondiente
    const { content, metadata } = generateAgentResponse(intent, message);

    // 3. Construir mensaje de respuesta
    const response: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'avi',
      content,
      agentId: intent.agent,
      timestamp: new Date().toISOString(),
      metadata,
    };

    return successResponse({
      message: response,
      intent: {
        detected: intent.intent,
        agent: intent.agent,
        confidence: intent.confidence,
      },
      sessionId: sessionId || crypto.randomUUID(),
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return errorResponse('Error al procesar mensaje', 500);
  }
}
