/**
 * Ciclo de vida del pedido: cancel, record_order, mark_delivered, sustituciones.
 * AVI propone, la familia decide. Nunca paga ni hace checkout.
 */

import { prisma } from '@/lib/prisma';

export class OrderError extends Error {}

// ── Cancel ──────────────────────────────────────────────────────

export async function cancelCart(
  familyId: string,
  cartId: string,
  memberId: string | null,
  reason?: string,
) {
  const cart = await prisma.proposedCart.findFirst({ where: { id: cartId, familyId } });
  if (!cart) throw new OrderError('No encontré ese carro en esta familia');
  if (!['proposed', 'approved'].includes(cart.status)) {
    throw new OrderError(`No se puede cancelar un carro en estado "${cart.status}". Solo proposed o approved.`);
  }

  const updated = await prisma.proposedCart.update({
    where: { id: cartId },
    data: {
      status: 'cancelled',
      cancelledByMemberId: memberId,
      cancelReason: reason || null,
      cancelledAt: new Date(),
      note: [cart.note, reason ? `Cancelado: ${reason}` : 'Cancelado'].filter(Boolean).join(' · '),
    },
  });

  await logActivity(familyId, memberId, 'cancelled_cart', 'proposed_cart', cartId, { reason });

  return { cartId: updated.id, status: 'cancelled', reason };
}

// ── Record Order ────────────────────────────────────────────────

interface RecordOrderInput {
  cartId: string;
  store: string;
  orderRef: string;
  placedAt: string;
  deliveryWindow?: string;
  lines: { name: string; qty: number; unitPrice: number; storeProductId?: string }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  adjustments: number;
  total: number;
  paymentLast4?: string;
}

export async function recordOrder(familyId: string, input: RecordOrderInput, memberId: string | null) {
  // ── Idempotencia completa por orderRef ──
  // Si ya existe un carro con este orderRef, no hacer nada
  const existingCart = await prisma.proposedCart.findFirst({
    where: { familyId, orderRef: input.orderRef },
  });
  if (existingCart) {
    return { cartId: existingCart.id, status: existingCart.status, orderRef: input.orderRef, message: 'Pedido ya registrado' };
  }
  // Si ya existen filas en purchase_history con este orderRef, solo vincular el carro
  const existingPurchases = await prisma.purchaseHistory.count({
    where: { orderRef: input.orderRef },
  });
  const alreadyImported = existingPurchases > 0;

  const cart = await prisma.proposedCart.findFirst({ where: { id: input.cartId, familyId } });
  if (!cart) throw new OrderError('No encontré ese carro en esta familia');
  if (!['approved', 'filled'].includes(cart.status)) {
    throw new OrderError(`El carro debe estar aprobado o lleno para registrar el pedido (estado: "${cart.status}")`);
  }

  // Validar totales: subtotal + deliveryFee - discount + adjustments = total
  const expectedTotal = input.subtotal + input.deliveryFee - input.discount + input.adjustments;
  if (Math.abs(expectedTotal - input.total) > 10) {
    throw new OrderError(
      `Los montos no cuadran: subtotal ($${input.subtotal}) + despacho ($${input.deliveryFee}) - descuento ($${input.discount}) + ajustes ($${input.adjustments}) = $${expectedTotal}, pero el total es $${input.total}.`
    );
  }

  // Avisar si hay otro carro abierto
  const otherOpen = await prisma.proposedCart.findFirst({
    where: { familyId, status: { in: ['proposed', 'approved'] }, id: { not: cart.id } },
    select: { id: true, storeName: true, status: true },
  });

  // Resolver userId
  let userId = 'unknown';
  if (memberId) {
    const member = await prisma.familyMember.findFirst({
      where: { id: memberId, familyId },
      select: { userId: true },
    });
    if (member?.userId) userId = member.userId;
  }
  if (userId === 'unknown') {
    const master = await prisma.familyMember.findFirst({
      where: { familyId, role: 'master', isActive: true },
      select: { userId: true },
    });
    if (master?.userId) userId = master.userId;
  }

  const storeSlug = input.store.toLowerCase().replace(/\s+/g, '_');
  const motivo = cart.motivo || 'para_la_casa';
  const placedAt = new Date(input.placedAt);

  await prisma.$transaction(async (tx) => {
    // Pasar carro a ordered
    await tx.proposedCart.update({
      where: { id: cart.id },
      data: {
        status: 'ordered',
        orderRef: input.orderRef,
        orderedAt: placedAt,
        subtotal: input.subtotal,
        delivery: input.deliveryFee,
        deliveryFee: input.deliveryFee,
        discount: input.discount,
        total: input.total,
        paymentLast4: input.paymentLast4 || null,
        note: [
          cart.note,
          `Pedido ${input.orderRef} · $${input.total.toLocaleString('es-CL')}`,
          input.paymentLast4 ? `Tarjeta ****${input.paymentLast4}` : null,
          input.deliveryWindow ? `Despacho: ${input.deliveryWindow}` : null,
        ].filter(Boolean).join(' · '),
      },
    });

    // Insertar order_lines (las líneas REALES cobradas, no las del carro)
    for (const line of input.lines) {
      await tx.orderLine.create({
        data: {
          cartId: cart.id,
          familyId,
          orderRef: input.orderRef,
          productName: line.name,
          quantity: line.qty,
          unitPrice: line.unitPrice,
          subtotal: Math.round(line.qty * line.unitPrice),
          storeProductId: line.storeProductId || null,
        },
      });
    }

    // Insertar en purchase_history SOLO si no estaba importado antes
    if (!alreadyImported) {
      for (const line of input.lines) {
        await tx.purchaseHistory.create({
          data: {
            userId,
            familyId,
            productName: line.name,
            storeSlug,
            storeName: input.store,
            price: line.unitPrice,
            quantity: line.qty,
            orderRef: input.orderRef,
            source: storeSlug,
            motivo,
            purchasedAt: placedAt,
          },
        });
      }
    }
  });

  await logActivity(familyId, memberId, 'recorded_order', 'proposed_cart', cart.id, {
    orderRef: input.orderRef,
    store: input.store,
    total: input.total,
    lines: input.lines.length,
    alreadyImported,
  });

  return {
    cartId: cart.id,
    status: 'ordered',
    orderRef: input.orderRef,
    total: input.total,
    linesRecorded: input.lines.length,
    alreadyImported: alreadyImported ? 'Las compras ya estaban en el historial — solo se vinculó el carro.' : undefined,
    ...(otherOpen ? { warning: `Hay otro carro abierto (${otherOpen.storeName}, ${otherOpen.status}). Revisa que no estén comprando doble.` } : {}),
  };
}

// ── Mark Delivered ──────────────────────────────────────────────

interface DeliveryAdjustment {
  name: string;
  deliveredQty: number;
  originalQty?: number;
  substitutedFor?: string;
}

export async function markDelivered(
  familyId: string,
  cartId: string,
  memberId: string | null,
  adjustments?: DeliveryAdjustment[],
) {
  const cart = await prisma.proposedCart.findFirst({ where: { id: cartId, familyId } });
  if (!cart) throw new OrderError('No encontré ese carro en esta familia');
  if (cart.status !== 'ordered') {
    throw new OrderError(`El carro debe estar en estado "ordered" para marcar como entregado (estado: "${cart.status}")`);
  }

  await prisma.proposedCart.update({
    where: { id: cartId },
    data: { status: 'delivered', deliveredAt: new Date() },
  });

  // Log adjustments (faltantes / sustituciones)
  const adjustmentsSummary: string[] = [];
  if (adjustments?.length) {
    for (const adj of adjustments) {
      if (adj.deliveredQty === 0) {
        adjustmentsSummary.push(`❌ No llegó: ${adj.name}`);
      } else if (adj.substitutedFor) {
        adjustmentsSummary.push(`🔄 ${adj.name} sustituido por ${adj.substitutedFor}`);
      } else if (adj.originalQty && adj.deliveredQty !== adj.originalQty) {
        adjustmentsSummary.push(`📦 ${adj.name}: pedido ${adj.originalQty}, llegó ${adj.deliveredQty}`);
      }
    }

    // Update purchase_history for missing items (set qty to 0 or adjusted qty)
    if (cart.orderRef) {
      for (const adj of adjustments) {
        if (adj.deliveredQty === 0) {
          await prisma.purchaseHistory.updateMany({
            where: { familyId, orderRef: cart.orderRef, productName: { contains: adj.name } },
            data: { quantity: 0 },
          });
        } else if (adj.originalQty && adj.deliveredQty !== adj.originalQty) {
          await prisma.purchaseHistory.updateMany({
            where: { familyId, orderRef: cart.orderRef, productName: { contains: adj.name } },
            data: { quantity: adj.deliveredQty },
          });
        }
      }
    }
  }

  await logActivity(familyId, memberId, 'marked_delivered', 'proposed_cart', cartId, {
    adjustments: adjustmentsSummary,
  });

  return {
    cartId,
    status: 'delivered',
    adjustments: adjustmentsSummary.length > 0 ? adjustmentsSummary : 'Sin ajustes — todo llegó como se pidió',
  };
}

// ── Substitution Preferences ────────────────────────────────────

export async function saveSubstitutionPreference(
  familyId: string,
  original: string,
  substitute: string,
  accepted: boolean,
) {
  await prisma.substitutionPreference.create({
    data: {
      familyId,
      originalGroupKey: original.toLowerCase().replace(/\s+/g, '_'),
      originalName: original,
      substituteName: substitute,
      accepted,
    },
  });

  await logActivity(familyId, null, accepted ? 'accepted_substitution' : 'rejected_substitution', 'substitution', undefined, {
    original,
    substitute,
    accepted,
  });

  return {
    original,
    substitute,
    accepted,
    message: accepted
      ? `Guardado: la próxima vez AVI ofrecerá "${substitute}" cuando no haya "${original}".`
      : `Guardado: AVI no volverá a ofrecer "${substitute}" como reemplazo de "${original}".`,
  };
}

// ── Helpers ─────────────────────────────────────────────────────

async function logActivity(familyId: string, memberId: string | null, action: string, entityType?: string, entityId?: string, payload?: object) {
  prisma.familyActivity.create({
    data: { familyId, memberId, action, entityType, entityId, payload: payload ?? {} },
  }).catch((e: unknown) => console.warn('[order-lifecycle]', e instanceof Error ? e.message : e));
}
