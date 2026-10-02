/**
 * AVI Agent — Agente conversacional con tool_use
 *
 * Recibe mensajes en lenguaje natural y ejecuta tools:
 * - add_item: agregar producto a lista
 * - remove_item: quitar producto de lista
 * - get_list: ver lista actual
 * - compare_prices: comparar precios en supermercados
 * - check_nutrition: consultar datos nutricionales
 * - check_budget: ver estado del presupuesto
 * - get_replenishment: ver que se esta acabando
 * - record_purchase: registrar compra ("compré X en Y")
 * - get_favorites: ver productos favoritos de la familia
 * - suggest_products: sugerir que comprar basado en historial
 * - get_replenishment: ver que se esta acabando
 * - record_purchase: registrar compra ("compré X en Y")
 *
 * Usa Claude API con tool_use para interpretar la intencion
 * y ejecutar la accion correcta.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { recordPurchase, getProductProfiles, getSuggestions, getFamilyProfileSummary } from './purchase-learning.service';
import { generateCheckoutPlan, formatCheckoutMessage } from './checkout.service';
import { generateMonthlyReport } from './monthly-nutrition.service';

const STORE_NAMES: Record<string, string> = {
  jumbo: 'Jumbo', lider: 'Lider', unimarc: 'Unimarc', 'santa-isabel': 'Santa Isabel',
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_item',
    description: 'Agrega un producto a la lista de compras del usuario. Usa cuando el usuario dice "agrega", "pon", "necesito", "quiero comprar".',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto' },
        quantity: { type: 'number', description: 'Cantidad (default 1)' },
        urgent: { type: 'boolean', description: 'Si es urgente' },
      },
      required: ['name'],
    },
  },
  {
    name: 'remove_item',
    description: 'Quita un producto de la lista. Usa cuando dice "quita", "saca", "elimina", "ya no necesito".',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto a quitar' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_list',
    description: 'Muestra la lista de compras actual. Usa cuando dice "mi lista", "que tengo", "muéstrame la lista".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'compare_prices',
    description: 'Compara precios de un producto en supermercados. Usa cuando dice "cuánto cuesta", "dónde es más barato", "precio de", "comparar".',
    input_schema: {
      type: 'object' as const,
      properties: {
        product: { type: 'string', description: 'Producto a buscar' },
      },
      required: ['product'],
    },
  },
  {
    name: 'check_nutrition',
    description: 'Consulta datos nutricionales de un producto. Usa cuando dice "es saludable", "calorías", "nutricional", "engorda".',
    input_schema: {
      type: 'object' as const,
      properties: {
        product: { type: 'string', description: 'Producto a consultar' },
      },
      required: ['product'],
    },
  },
  {
    name: 'check_budget',
    description: 'Muestra el estado del presupuesto. Usa cuando dice "cuánto llevo", "presupuesto", "gastos", "plata".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_replenishment',
    description: 'Muestra qué productos se están acabando. Usa cuando dice "qué falta", "qué se acabó", "qué comprar", "reposición".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'record_purchase',
    description: 'Registra una compra ya realizada. Usa cuando dice "compré X en Y", "gasté X en Y". IMPORTANTE: siempre pregunta marca, tienda y precio si no los menciona.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product: { type: 'string', description: 'Qué compró (nombre del producto)' },
        brand: { type: 'string', description: 'Marca del producto' },
        store: { type: 'string', description: 'Dónde compró (Jumbo, Lider, Santa Isabel, Unimarc)' },
        amount: { type: 'number', description: 'Cuánto gastó en CLP' },
        quantity: { type: 'number', description: 'Cantidad (default 1)' },
        category: { type: 'string', description: 'Categoría (lacteos, carnes, frutas, despensa, bebidas, limpieza)' },
      },
      required: ['product'],
    },
  },
  {
    name: 'get_favorites',
    description: 'Muestra los productos favoritos de la familia con marcas y tiendas preferidas. Usa cuando dice "qué compro siempre", "mis favoritos", "productos frecuentes".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'suggest_products',
    description: 'Sugiere productos que la familia debería comprar basado en su historial. Usa cuando dice "qué me falta", "qué debería comprar", "arma mi lista", "sugerencias".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_family',
    description: 'Muestra los miembros de la familia con sus alergias y restricciones. Usa cuando dice "mi familia", "quienes somos", "alergias de la familia", "miembros".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'monthly_nutrition',
    description: 'Analiza el consumo nutricional del mes: calorias, azucar, sodio, ultra-procesados. Usa cuando dice "como vamos de nutricion", "calorias del mes", "comemos sano", "analisis mensual", "habitos".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'checkout',
    description: 'Genera links de compra directos al supermercado. Usa cuando el usuario dice "comprar", "hacer la compra", "pedir", "checkout", "ir a pagar", "arma el carrito". Genera links para que el usuario abra cada producto en el super y lo agregue al carrito.',
    input_schema: {
      type: 'object' as const,
      properties: {
        store: { type: 'string', description: 'Supermercado preferido (jumbo, lider, unimarc, santa-isabel). Si no dice, usa el que tenga mejores precios.' },
      },
    },
  },
];

const SYSTEM_PROMPT = `Eres AVI, el asistente inteligente de compras familiares para Chile.
Tu trabajo es ayudar a familias chilenas a comprar mejor, más barato y más sano.

Reglas:
- Responde SIEMPRE en español chileno casual pero respetuoso
- Sé breve y directo (máximo 2-3 oraciones)
- Usa las herramientas para ejecutar acciones, no solo describir
- Si el usuario pide algo que no puedes hacer, dilo honestamente
- Precios en CLP (pesos chilenos)
- Supermercados: Jumbo, Lider, Santa Isabel, Unimarc

IMPORTANTE sobre compras:
- Cuando el usuario registra una compra, SIEMPRE pregunta: marca, tienda, precio y cantidad si no los da
- Aprende de cada compra: recuerda marcas preferidas, tiendas favoritas
- Cuando sugiere productos, usa la marca y tienda que la familia prefiere
- Si la familia siempre compra "Leche Colun en Jumbo", sugiere eso, no "leche" genérica

NUDGE PROACTIVO:
- Si el usuario solo dice "hola" o un saludo, usa get_replenishment o suggest_products para sugerir algo útil
- Si hay productos que se están acabando, avísale proactivamente
- Si el presupuesto está al 80%+, avisa al usuario
- Siempre ofrece una acción concreta, no solo información

Si no entiendes, pregunta. No adivines.`;

interface ToolResult {
  success: boolean;
  data: any;
  message: string;
}

/**
 * Ejecuta una tool call del agente
 */
async function executeTool(
  toolName: string,
  input: Record<string, any>,
  userId: string
): Promise<ToolResult> {
  switch (toolName) {
    case 'add_item': {
      let list = await prisma.shoppingList.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      if (!list) {
        list = await prisma.shoppingList.create({
          data: { userId, name: 'Mi lista' },
        });
      }

      const item = await prisma.shoppingItem.create({
        data: {
          shoppingListId: list.id,
          name: input.name,
          quantity: input.quantity || 1,
          urgent: input.urgent || false,
        },
      });

      return {
        success: true,
        data: { item: item.name, quantity: item.quantity, list: list.name },
        message: `${item.name} x${item.quantity} agregado a "${list.name}"`,
      };
    }

    case 'remove_item': {
      const list = await prisma.shoppingList.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { items: true },
      });

      if (!list) return { success: false, data: null, message: 'No tienes lista de compras' };

      const item = list.items.find((i) =>
        i.name.toLowerCase().includes(input.name.toLowerCase())
      );

      if (!item) return { success: false, data: null, message: `No encontré "${input.name}" en tu lista` };

      await prisma.shoppingItem.delete({ where: { id: item.id } });
      return { success: true, data: { removed: item.name }, message: `${item.name} eliminado de tu lista` };
    }

    case 'get_list': {
      const list = await prisma.shoppingList.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { items: true },
      });

      if (!list || list.items.length === 0) {
        return { success: true, data: { items: [] }, message: 'Tu lista está vacía' };
      }

      const items = list.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        checked: i.checked,
        urgent: i.urgent,
      }));

      return {
        success: true,
        data: { listName: list.name, items, total: items.length },
        message: `"${list.name}" tiene ${items.length} productos`,
      };
    }

    case 'compare_prices': {
      // Buscar precios en cache primero
      const cached = await prisma.priceObservation.findMany({
        where: {
          searchTerm: { equals: input.product },
          observedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { observedAt: 'desc' },
        take: 20,
      });

      if (cached.length > 0) {
        // Filtrar por relevancia
        const queryWords = (input.product as string).toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const relevant = cached.filter((c) => {
          const nameLower = c.productName.toLowerCase();
          const matches = queryWords.filter((w: string) => nameLower.includes(w)).length;
          return queryWords.length === 0 || matches / queryWords.length >= 0.4;
        });
        const filtered = relevant.length > 0 ? relevant : cached;

        const seen = new Set<string>();
        const prices = filtered.filter((c) => {
          const key = `${c.productName}|${c.storeSlug}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).map((c) => ({
          product: c.productName,
          store: c.storeName,
          price: c.price,
        }));

        const cheapest = prices.reduce((min, p) => (p.price < min.price ? p : min));
        return {
          success: true,
          data: { prices, cheapest },
          message: `Encontré ${prices.length} precios. El más barato: ${cheapest.product} en ${cheapest.store} a $${cheapest.price.toLocaleString('es-CL')}`,
        };
      }

      return {
        success: true,
        data: { prices: [], note: 'Sin datos en cache' },
        message: `No tengo precios recientes de "${input.product}". Usa /comparar en la app para buscar precios en vivo.`,
      };
    }

    case 'check_nutrition': {
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(input.product)}&json=1&page_size=1&cc=cl&fields=product_name,brands,nutriscore_grade,nova_group,nutriments`
        );
        const data = await res.json();

        if (data.products?.length > 0) {
          const p = data.products[0];
          const n = p.nutriments || {};
          return {
            success: true,
            data: {
              name: p.product_name,
              brand: p.brands,
              nutriscore: p.nutriscore_grade?.toUpperCase(),
              nova: p.nova_group,
              calories: n['energy-kcal_100g'],
              sugar: n['sugars_100g'],
              fat: n['fat_100g'],
              sodium: n['sodium_100g'],
              protein: n['proteins_100g'],
            },
            message: `${p.product_name}: NutriScore ${p.nutriscore_grade?.toUpperCase() || '?'}, NOVA ${p.nova_group || '?'}, ${Math.round(n['energy-kcal_100g'] || 0)} kcal/100g`,
          };
        }
        return { success: false, data: null, message: `No encontré datos nutricionales de "${input.product}"` };
      } catch {
        return { success: false, data: null, message: 'Error al consultar datos nutricionales' };
      }
    }

    case 'check_budget': {
      const now = new Date();
      const budget = await prisma.budget.findFirst({
        where: { userId, startDate: { lte: now }, endDate: { gte: now } },
      });

      if (!budget) return { success: true, data: null, message: 'No tienes presupuesto activo' };

      const pct = Math.round((budget.spent / budget.amount) * 100);
      const remaining = budget.amount - budget.spent;
      return {
        success: true,
        data: { amount: budget.amount, spent: budget.spent, remaining, pct },
        message: `Presupuesto: $${budget.spent.toLocaleString('es-CL')} de $${budget.amount.toLocaleString('es-CL')} (${pct}%). Te quedan $${remaining.toLocaleString('es-CL')}.`,
      };
    }

    case 'get_replenishment': {
      const orders = await prisma.order.findMany({
        where: { userId, status: { in: ['delivered', 'confirmed'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      if (orders.length === 0) {
        return { success: true, data: { alerts: [] }, message: 'No tengo suficiente historial para predecir reposición. Sigue comprando y AVI aprenderá.' };
      }

      return {
        success: true,
        data: { ordersCount: orders.length },
        message: 'Revisa /reposicion en la app para ver predicciones detalladas basadas en tu historial.',
      };
    }

    case 'record_purchase': {
      const storeMap: Record<string, string> = { jumbo: 'jumbo', lider: 'lider', 'santa isabel': 'santa-isabel', unimarc: 'unimarc' };
      const storeSlug = input.store ? storeMap[input.store.toLowerCase()] || input.store.toLowerCase() : undefined;

      await recordPurchase(userId, {
        productName: input.product,
        brand: input.brand,
        category: input.category,
        storeSlug,
        storeName: input.store,
        price: input.amount,
        quantity: input.quantity || 1,
        source: 'agent',
      });

      let msg = `Registrado: ${input.product}`;
      if (input.brand) msg += ` (${input.brand})`;
      if (input.store) msg += ` en ${input.store}`;
      if (input.amount) msg += ` por $${input.amount.toLocaleString('es-CL')}`;
      msg += '. AVI ya aprendió esta compra.';

      const missing = [];
      if (!input.brand) missing.push('marca');
      if (!input.store) missing.push('tienda');
      if (!input.amount) missing.push('precio');
      if (missing.length > 0) msg += ` Para aprender mejor, dime también: ${missing.join(', ')}.`;

      return { success: true, data: { product: input.product, brand: input.brand, store: input.store, amount: input.amount }, message: msg };
    }

    case 'get_favorites': {
      const profiles = await getProductProfiles(userId, 10);
      if (profiles.length === 0) {
        return { success: true, data: { favorites: [] }, message: 'Aún no conozco tus compras. Dime "compré X en Y" para que empiece a aprender.' };
      }

      const favList = profiles.map((p) => {
        let desc = `${p.productName}`;
        if (p.preferredBrand) desc += ` (${p.preferredBrand})`;
        if (p.preferredStore) desc += ` — ${p.preferredStore}`;
        if (p.avgPrice > 0) desc += ` ~$${p.avgPrice.toLocaleString('es-CL')}`;
        desc += ` · ${p.totalPurchases} compras`;
        return desc;
      });

      return {
        success: true,
        data: { favorites: profiles.map((p) => ({ name: p.productName, brand: p.preferredBrand, store: p.preferredStore, purchases: p.totalPurchases })) },
        message: `Tus ${profiles.length} productos más frecuentes:\n${favList.join('\n')}`,
      };
    }

    case 'suggest_products': {
      const suggestions = await getSuggestions(userId);
      if (suggestions.length === 0) {
        return { success: true, data: { suggestions: [] }, message: 'Necesito más historial para sugerir. Registra compras con "compré X en Y" y AVI aprenderá.' };
      }

      const urgencyEmoji = { high: '🔴', medium: '🟡', low: '🔵' };
      const lines = suggestions.map((s) => {
        let line = `${urgencyEmoji[s.urgency]} ${s.productName}`;
        if (s.brand) line += ` (${s.brand})`;
        if (s.store) line += ` — ${s.store}`;
        line += ` x${s.suggestedQuantity}`;
        return line;
      });

      return {
        success: true,
        data: { suggestions },
        message: `Te sugiero agregar ${suggestions.length} productos:\n${lines.join('\n')}`,
      };
    }

    case 'monthly_nutrition': {
      try {
        const report = await generateMonthlyReport(userId);
        const lines = [`📊 Reporte nutricional — ${report.month}`];
        lines.push(`Familia: ${report.familySize} persona${report.familySize > 1 ? 's' : ''}, ${report.totalProducts} productos`);
        lines.push('');
        if (report.estimatedCalories > 0) lines.push(`🔥 Calorias: ~${report.estimatedCalories.toLocaleString('es-CL')} kcal`);
        if (report.estimatedSugar > 0) lines.push(`🍬 Azucar: ~${report.estimatedSugar}g`);
        if (report.estimatedSodium > 0) lines.push(`🧂 Sodio: ~${report.estimatedSodium}g`);
        if (report.ultraProcessedPercent > 0) lines.push(`🏭 Ultra-procesados: ${report.ultraProcessedPercent}%`);

        if (report.alerts.length > 0) {
          lines.push('');
          lines.push('⚠️ Alertas:');
          report.alerts.forEach((a) => lines.push(`  ${a.severity === 'critical' ? '🔴' : '🟡'} ${a.title}`));
        }

        if (report.habits.length > 0) {
          lines.push('');
          lines.push('💡 Sugerencias:');
          report.habits.forEach((h) => lines.push(`  • ${h.title}: ${h.impact}`));
        }

        return { success: true, data: report, message: lines.join('\n') };
      } catch {
        return { success: false, data: null, message: 'Necesito mas historial de compras para generar el reporte. Registra compras con "compre X en Y".' };
      }
    }

    case 'get_family': {
      const membership = await prisma.familyMember.findFirst({
        where: { userId },
        include: {
          family: {
            include: { members: { where: { isActive: true } } },
          },
        },
      });

      if (!membership) {
        return { success: true, data: null, message: 'No tienes familia configurada. Ve a /familia para crear tu grupo familiar.' };
      }

      const members = membership.family.members.map((m) => {
        const allergies = m.allergies ? JSON.parse(m.allergies) : [];
        return `${m.type === 'pet' ? '🐾' : '👤'} ${m.name} (${m.role})${m.dietType ? ` · ${m.dietType}` : ''}${allergies.length > 0 ? ` · ⚠️ ${allergies.join(', ')}` : ''}${m.species ? ` · ${m.species}${m.breed ? ` ${m.breed}` : ''}` : ''}`;
      });

      return {
        success: true,
        data: { familyName: membership.family.name, members: membership.family.members },
        message: `Familia "${membership.family.name}" (${membership.family.members.length} miembros):\n${members.join('\n')}`,
      };
    }

    case 'checkout': {
      // Obtener lista de compras activa
      const list = await prisma.shoppingList.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { items: { where: { checked: false } } },
      });

      if (!list || list.items.length === 0) {
        return { success: false, data: null, message: 'Tu lista esta vacia. Agrega productos primero.' };
      }

      // Buscar precios recientes para cada item
      const checkoutItems = [];
      const preferredStore = input.store?.toLowerCase();

      for (const item of list.items) {
        // Buscar precio en cache
        const priceObs = await prisma.priceObservation.findFirst({
          where: {
            searchTerm: { equals: item.name.split(' ')[0] },
            ...(preferredStore ? { storeSlug: preferredStore } : {}),
            observedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          },
          orderBy: { price: 'asc' },
        });

        const storeSlug = priceObs?.storeSlug || preferredStore || 'jumbo';
        const storeName = priceObs?.storeName || (STORE_NAMES as any)[storeSlug] || 'Jumbo';

        checkoutItems.push({
          productName: item.name,
          store: storeName,
          storeSlug,
          price: priceObs?.price || 0,
          quantity: item.quantity,
          productUrl: priceObs?.url || undefined,
        });
      }

      const plan = generateCheckoutPlan(checkoutItems);
      const message = formatCheckoutMessage(plan);

      return {
        success: true,
        data: { plan },
        message,
      };
    }

    default:
      return { success: false, data: null, message: `Tool desconocida: ${toolName}` };
  }
}

/**
 * Procesa un mensaje del usuario con el agente AVI
 */
export async function processAgentMessage(
  message: string,
  userId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{
  response: string;
  toolsUsed: Array<{ tool: string; result: ToolResult }>;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      response: 'El agente AVI necesita ANTHROPIC_API_KEY configurada. Mientras tanto, usa las páginas de la app directamente.',
      toolsUsed: [],
    };
  }

  const client = new Anthropic({
    apiKey,
    defaultHeaders: {
      'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID || '',
    },
  });

  // Cargar perfil de la familia para contexto
  let familyContext = '';
  try {
    familyContext = await getFamilyProfileSummary(userId);
  } catch {}

  // Cargar alergias de la familia
  let familyAllergiesContext = '';
  try {
    const membership = await prisma.familyMember.findFirst({
      where: { userId },
      include: { family: { include: { members: { where: { isActive: true } } } } },
    });
    if (membership?.family?.members) {
      const allergyLines = membership.family.members
        .filter((m) => m.allergies || m.dietType)
        .map((m) => {
          const allergies = m.allergies ? JSON.parse(m.allergies) : [];
          return `- ${m.name}: ${m.dietType ? m.dietType + '. ' : ''}${allergies.length > 0 ? 'ALERGICO a: ' + allergies.join(', ') : ''}`;
        });
      if (allergyLines.length > 0) {
        familyAllergiesContext = `\n\nALERGIAS Y DIETAS DE LA FAMILIA (VERIFICAR SIEMPRE):\n${allergyLines.join('\n')}\nCuando el usuario agrega un producto, VERIFICA si contiene alergenos de algun miembro.`;
      }
    }
  } catch {}

  const systemPrompt = `${SYSTEM_PROMPT}${familyContext ? `\n\nPERFIL DE COMPRAS DE ESTA FAMILIA:\n${familyContext}` : ''}${familyAllergiesContext}`;

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  const toolsUsed: Array<{ tool: string; result: ToolResult }> = [];

  // Primera llamada: Claude decide que tools usar
  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });

  // Loop de tool_use
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, any>, userId);
      toolsUsed.push({ tool: toolUse.name, result });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Segunda llamada: Claude responde con los resultados
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
  }

  // Extraer texto de la respuesta
  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );
  const responseText = textBlocks.map((b) => b.text).join('\n');

  return { response: responseText, toolsUsed };
}
