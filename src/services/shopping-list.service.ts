/**
 * Lista familiar de compras.
 *
 * Flujo real del hogar:
 * 1. Cualquiera agrega ("falta leche", "la nana dice que no hay Quix").
 * 2. AVI normaliza contra el historial (marca, formato, precio habitual).
 * 3. AVI sugiere agotados de la despensa y pregunta al resto.
 * 4. Cada aprobador confirma. Con TODOS de acuerdo → carro propuesto.
 *
 * AVI propone, la familia decide. NUNCA paga ni hace checkout.
 */

import { prisma } from '@/lib/prisma';
import { parseMemberAllergies, proposeCart, McpToolError } from '@/lib/mcp/tools';
import { getHouseholdIntelligence } from '@/services/consumption/household-intelligence';
import { isApprover } from '@/lib/family/approver';
import type { StoreName } from '@/types/nutrition';

// ── Abrir o retomar la lista ──────────────────────────────────

export async function openList(
  familyId: string,
  memberId: string | null,
  opts?: { title?: string; targetDate?: string },
) {
  const existing = await prisma.familyShoppingList.findFirst({
    where: { familyId, status: 'open' },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      confirmations: { include: { member: { select: { name: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (existing) return existing;

  return prisma.familyShoppingList.create({
    data: {
      familyId,
      status: 'open',
      title: opts?.title || null,
      storeHint: null,
      targetDate: opts?.targetDate ? new Date(opts.targetDate) : null,
      createdByMemberId: memberId,
    },
    include: {
      items: true,
      confirmations: true,
      messages: true,
    },
  });
}

// ── Agregar ítems con normalización ──────────────────────────

interface RawItem {
  rawText: string;
  qty?: number;
  requestedByLabel?: string;
}

interface NormalizedResult {
  added: {
    id: string;
    rawText: string;
    normalizedName: string | null;
    brand: string | null;
    unitPriceClp: number | null;
    priceSource: string | null;
    groupKey: string | null;
    allergenWarnings: unknown[];
  }[];
  questions: { rawText: string; options: string[] }[];
}

export async function addListItems(
  familyId: string,
  listId: string,
  items: RawItem[],
  memberId: string | null,
): Promise<NormalizedResult> {
  const list = await prisma.familyShoppingList.findFirst({
    where: { id: listId, familyId, status: 'open' },
  });
  if (!list) throw new McpToolError('No hay una lista abierta para agregar productos');

  // Load family allergies for checking
  const familyMembers = await prisma.familyMember.findMany({
    where: { familyId, isActive: true },
    select: { name: true, allergies: true },
  });
  const memberAllergies = familyMembers
    .map((m) => ({ name: m.name, allergens: parseMemberAllergies(m.allergies) }))
    .filter((m) => m.allergens.length > 0);

  const added: NormalizedResult['added'] = [];
  const questions: NormalizedResult['questions'] = [];

  for (const item of items) {
    const text = item.rawText.trim();
    if (!text) continue;

    // Search purchase_history for normalization
    const matches = await prisma.purchaseHistory.findMany({
      where: {
        familyId,
        productName: { contains: text, mode: 'insensitive' },
      },
      orderBy: { purchasedAt: 'desc' },
      take: 10,
      select: { productName: true, brand: true, price: true, groupKey: true, storeSlug: true },
    });

    // Deduplicate by productName
    const uniqueProducts = new Map<string, typeof matches[0]>();
    for (const m of matches) {
      if (!uniqueProducts.has(m.productName)) uniqueProducts.set(m.productName, m);
    }
    const distinct = [...uniqueProducts.values()];

    if (distinct.length > 3) {
      // Too many matches — ask the user
      questions.push({
        rawText: text,
        options: distinct.slice(0, 5).map((d) => `${d.productName}${d.brand ? ` (${d.brand})` : ''}`),
      });
      continue;
    }

    const best = distinct[0] || null;

    // Check allergens
    const warnings: { member: string; allergen: string }[] = [];
    const productLower = (best?.productName || text).toLowerCase();
    for (const ma of memberAllergies) {
      for (const allergen of ma.allergens) {
        if (productLower.includes(allergen.toLowerCase())) {
          warnings.push({ member: ma.name, allergen });
        }
      }
    }

    const created = await prisma.familyShoppingListItem.create({
      data: {
        listId,
        rawText: text,
        normalizedName: best?.productName || null,
        brand: best?.brand || null,
        groupKey: best?.groupKey || null,
        quantity: item.qty || 1,
        unitPriceClp: best?.price || null,
        priceSource: best ? 'history' : null,
        requestedByMemberId: memberId,
        requestedByLabel: item.requestedByLabel || null,
        source: 'member',
        status: 'pending',
        allergenWarnings: warnings.length > 0 ? warnings : [],
      },
    });

    added.push({
      id: created.id,
      rawText: text,
      normalizedName: created.normalizedName,
      brand: created.brand,
      unitPriceClp: created.unitPriceClp,
      priceSource: created.priceSource,
      groupKey: created.groupKey,
      allergenWarnings: warnings,
    });
  }

  return { added, questions };
}

// ── Obtener la lista completa ──────────────────────────────

export async function getList(familyId: string) {
  const list = await prisma.familyShoppingList.findFirst({
    where: { familyId, status: { in: ['open', 'consolidating', 'confirmed'] } },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      confirmations: { include: { member: { select: { name: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!list) return { list: null, message: 'No hay una lista abierta. Usa open_list para crear una.' };

  // Calculate totals
  const acceptedItems = list.items.filter((i) => i.status !== 'rejected');
  const totalEstimated = acceptedItems.reduce(
    (sum, i) => sum + (i.unitPriceClp ? Math.round(i.unitPriceClp * i.quantity) : 0),
    0,
  );
  const withoutPrice = acceptedItems.filter((i) => !i.unitPriceClp).length;

  // Who hasn't confirmed
  const approvers = await prisma.familyMember.findMany({
    where: { familyId, isActive: true, role: 'master' },
    select: { id: true, name: true },
  });
  const confirmedIds = new Set(list.confirmations.map((c) => c.memberId));
  const pendingApprovers = approvers.filter((a) => !confirmedIds.has(a.id));

  // Allergen summary
  const allWarnings = list.items
    .flatMap((i) => (Array.isArray(i.allergenWarnings) ? i.allergenWarnings : []) as { member: string; allergen: string }[])
    .filter((w) => w.member && w.allergen);

  return {
    list: {
      id: list.id,
      status: list.status,
      title: list.title,
      targetDate: list.targetDate,
      itemCount: list.items.length,
      items: list.items.map((i) => ({
        id: i.id,
        rawText: i.rawText,
        normalizedName: i.normalizedName,
        brand: i.brand,
        quantity: i.quantity,
        unitPriceClp: i.unitPriceClp,
        subtotal: i.unitPriceClp ? Math.round(i.unitPriceClp * i.quantity) : null,
        priceSource: i.priceSource,
        source: i.source,
        status: i.status,
        requestedBy: i.requestedByLabel || null,
        allergenWarnings: i.allergenWarnings,
        groupKey: i.groupKey,
      })),
    },
    totalEstimated,
    withoutPrice,
    confirmations: list.confirmations.map((c) => ({ member: c.member.name, confirmedAt: c.confirmedAt })),
    pendingApprovers: pendingApprovers.map((a) => a.name),
    allergenSummary: allWarnings,
    messages: list.messages.map((m) => ({ kind: m.kind, body: m.body, author: m.authorLabel, createdAt: m.createdAt })),
  };
}

// ── Actualizar / eliminar ítems ──────────────────────────────

export async function updateListItem(
  familyId: string,
  itemId: string,
  data: { qty?: number; status?: string; note?: string },
) {
  const item = await prisma.familyShoppingListItem.findFirst({
    where: { id: itemId },
    include: { list: { select: { familyId: true, status: true } } },
  });
  if (!item || item.list.familyId !== familyId) throw new McpToolError('Ítem no encontrado');
  if (item.list.status !== 'open') throw new McpToolError('La lista ya no está abierta para cambios');

  const update: Record<string, unknown> = {};
  if (data.qty != null) update.quantity = data.qty;
  if (data.status) update.status = data.status;
  if (data.note !== undefined) update.note = data.note;

  return prisma.familyShoppingListItem.update({ where: { id: itemId }, data: update });
}

export async function removeListItem(familyId: string, itemId: string) {
  const item = await prisma.familyShoppingListItem.findFirst({
    where: { id: itemId },
    include: { list: { select: { familyId: true, status: true } } },
  });
  if (!item || item.list.familyId !== familyId) throw new McpToolError('Ítem no encontrado');
  if (item.list.status !== 'open') throw new McpToolError('La lista ya no está abierta para cambios');

  await prisma.familyShoppingListItem.delete({ where: { id: itemId } });
  return { removed: true, rawText: item.rawText };
}

// ── Sugerencias de AVI ──────────────────────────────────────

export async function suggestForList(familyId: string, listId: string) {
  const list = await prisma.familyShoppingList.findFirst({
    where: { id: listId, familyId },
    include: { items: { select: { groupKey: true, normalizedName: true } } },
  });
  if (!list) throw new McpToolError('Lista no encontrada');

  const intel = await getHouseholdIntelligence(familyId);
  const existingKeys = new Set(list.items.map((i) => i.groupKey).filter(Boolean));
  const existingNames = new Set(list.items.map((i) => i.normalizedName?.toLowerCase()).filter(Boolean));

  const suggestions = intel.alerts
    .filter((p) => !existingKeys.has(p.groupKey) && !existingNames.has(p.groupKey.replace(/_/g, ' ')))
    .slice(0, 15)
    .map((p) => ({
      groupKey: p.groupKey,
      name: p.groupKey.replace(/_/g, ' '),
      status: p.status,
      statusLabel: p.statusLabel,
      alertMessage: p.alertMessage,
      suggestedQuantity: p.suggestedQuantity,
      lastPrice: p.lastPrice,
      estimatedCost: p.estimatedCost,
      typicalStore: p.typicalStore,
    }));

  return {
    suggestions,
    message: suggestions.length > 0
      ? `Encontré ${suggestions.length} producto${suggestions.length > 1 ? 's' : ''} que se están acabando y no están en la lista. ¿Agrego alguno?`
      : 'Todo lo urgente ya está en la lista. ¡Bien armada!',
  };
}

// ── Preguntar al hogar ──────────────────────────────────────

export async function askHousehold(
  familyId: string,
  listId: string,
  question: string,
  authorMemberId: string | null,
  toMemberIds?: string[],
) {
  const list = await prisma.familyShoppingList.findFirst({
    where: { id: listId, familyId },
  });
  if (!list) throw new McpToolError('Lista no encontrada');

  const message = await prisma.familyShoppingListMessage.create({
    data: {
      listId,
      authorMemberId: authorMemberId,
      authorLabel: 'AVI',
      kind: 'question',
      body: question,
    },
  });

  // Send email notification via Resend
  try {
    const { Resend } = await import('resend');
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (key && from) {
      const resend = new Resend(key);
      const targets = toMemberIds?.length
        ? await prisma.familyMember.findMany({
            where: { id: { in: toMemberIds }, familyId, isActive: true },
            include: { user: { select: { email: true } } },
          })
        : await prisma.familyMember.findMany({
            where: { familyId, isActive: true, role: 'master' },
            include: { user: { select: { email: true } } },
          });

      for (const t of targets) {
        if (!t.user?.email || t.id === authorMemberId) continue;
        await resend.emails.send({
          from,
          to: t.user.email,
          subject: `🛒 AVI pregunta: ${question.slice(0, 60)}`,
          text: `Hola ${t.name},\n\nAVI pregunta sobre la lista de compras:\n\n"${question}"\n\nResponde desde tu asistente.\n\nAVI propone, la familia decide.`,
        });
      }
    }
  } catch (e) {
    console.warn('[ask-household] email error:', e instanceof Error ? e.message : e);
  }

  return { messageId: message.id, question, sent: true };
}

// ── Confirmar la lista (solo aprobadores) ──────────────────

export async function confirmList(familyId: string, memberId: string) {
  const list = await prisma.familyShoppingList.findFirst({
    where: { familyId, status: { in: ['open', 'consolidating'] } },
  });
  if (!list) throw new McpToolError('No hay una lista pendiente de confirmación');

  // Upsert confirmation
  await prisma.familyShoppingListConfirmation.upsert({
    where: { listId_memberId: { listId: list.id, memberId } },
    create: { listId: list.id, memberId },
    update: { confirmedAt: new Date() },
  });

  // Check if all approvers confirmed
  const approvers = await prisma.familyMember.findMany({
    where: { familyId, isActive: true, role: 'master' },
    select: { id: true, name: true, role: true },
  });
  const settings = await prisma.familySettings.findUnique({ where: { familyId } });
  const approverIds = approvers.filter((a) => isApprover(a, settings)).map((a) => a.id);

  const confirmations = await prisma.familyShoppingListConfirmation.findMany({
    where: { listId: list.id },
    select: { memberId: true },
  });
  const confirmedIds = new Set(confirmations.map((c) => c.memberId));
  const missing = approverIds.filter((id) => !confirmedIds.has(id));

  if (missing.length === 0) {
    await prisma.familyShoppingList.update({
      where: { id: list.id },
      data: { status: 'confirmed' },
    });
  }

  const missingNames = approvers.filter((a) => missing.includes(a.id)).map((a) => a.name);

  return {
    listId: list.id,
    confirmed: missing.length === 0,
    missing: missingNames,
    message: missing.length === 0
      ? '¡Todos los aprobadores confirmaron! La lista está lista para convertir en carro.'
      : `Falta que confirme${missingNames.length > 1 ? 'n' : ''}: ${missingNames.join(', ')}.`,
  };
}

// ── Convertir lista confirmada en carro propuesto ──────────

export async function convertListToCart(
  familyId: string,
  store: StoreName,
  memberId: string | null,
) {
  const list = await prisma.familyShoppingList.findFirst({
    where: { familyId, status: 'confirmed' },
    include: { items: { where: { status: { not: 'rejected' } } } },
  });
  if (!list) throw new McpToolError('No hay una lista confirmada. Los aprobadores deben confirmar primero.');
  if (list.items.length === 0) throw new McpToolError('La lista no tiene ítems aceptados');

  const cartItems = list.items.map((i) => ({
    name: i.normalizedName || i.rawText,
    quantity: i.quantity,
    unit: 'un' as const,
    unitPriceClp: i.unitPriceClp || undefined,
  }));

  const result = await proposeCart(familyId, {
    store,
    items: cartItems,
    note: list.title || 'Lista familiar',
    motivo: 'para_la_casa',
  });

  await prisma.familyShoppingList.update({
    where: { id: list.id },
    data: { status: 'converted', cartId: result.cartId },
  });

  return {
    listId: list.id,
    cartId: result.cartId,
    store: result.store,
    subtotal: result.subtotal,
    items: result.items.length,
    message: `Lista convertida en carro propuesto en ${result.store} por $${result.subtotal.toLocaleString('es-CL')}. Falta que un aprobador lo apruebe.`,
  };
}
