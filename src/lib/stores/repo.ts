import { prisma } from '@/lib/prisma';
import type { FillRecord, StoreRepo } from './fill-cart';

/** Repositorio Prisma real. Todo filtra por familyId del token. */
export const prismaStoreRepo: StoreRepo = {
  async getCart(familyId, cartId) {
    return prisma.proposedCart.findFirst({ where: { id: cartId, familyId }, select: { id: true, storeSlug: true, status: true } });
  },
  async getApprovedItems(cartId) {
    return prisma.proposedCartItem.findMany({
      where: { cartId, approved: true },
      select: { id: true, name: true, quantity: true, payable: true, canonicalProductId: true },
    });
  },
  async findListingUrl(storeSlug, canonicalProductId) {
    const listing = await prisma.storeListing.findFirst({
      where: { storeSlug, canonicalId: canonicalProductId, inStock: true, url: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { url: true },
    });
    return listing?.url ?? null;
  },
  async getConnection(familyId, storeSlug) {
    return prisma.storeConnection.findUnique({
      where: { familyId_storeSlug: { familyId, storeSlug } },
      select: { encryptedSession: true, status: true },
    });
  },
  async saveConnection(familyId, storeSlug, data) {
    const verified = data.status === 'active' ? new Date() : undefined;
    if (data.encryptedSession) {
      await prisma.storeConnection.upsert({
        where: { familyId_storeSlug: { familyId, storeSlug } },
        create: { familyId, storeSlug, encryptedSession: data.encryptedSession, status: data.status, lastVerifiedAt: verified },
        update: { encryptedSession: data.encryptedSession, status: data.status, lastVerifiedAt: verified },
      });
    } else {
      await prisma.storeConnection.updateMany({ where: { familyId, storeSlug }, data: { status: data.status, lastVerifiedAt: verified } });
    }
  },
  async saveFill(record: FillRecord) {
    const row = await prisma.storeCartFill.create({
      data: {
        familyId: record.familyId,
        cartId: record.cartId,
        storeSlug: record.storeSlug,
        status: record.status,
        itemsRequested: record.itemsRequested,
        itemsAdded: record.itemsAdded,
        approvedTotal: record.approvedTotal,
        storeTotal: record.storeTotal,
        substitutes: JSON.stringify(record.substitutes),
        comparison: record.comparison ? JSON.stringify(record.comparison) : null,
        message: record.message,
      },
      select: { id: true },
    });
    return row.id;
  },
  async markCartFilled(cartId) {
    await prisma.proposedCart.updateMany({ where: { id: cartId, status: 'approved' }, data: { status: 'filled' } });
  },
};
