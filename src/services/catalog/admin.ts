import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { applyReview, ReviewAction } from './review';

export async function listCatalogQueue() {
  const [pending, products] = await Promise.all([
    prisma.catalogReview.findMany({
      where: { status: 'pending' },
      include: { listing: true, suggested: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.canonicalProduct.findMany({
      orderBy: { name: 'asc' },
      include: {
        listings: { select: { id: true, storeName: true, rawName: true, price: true, matchStatus: true } },
        substitutesFrom: { include: { to: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  return { pending, products };
}

export async function resolveCatalogReview(userId: string, input: {
  action: ReviewAction;
  reviewId: string;
  canonicalId?: string | null;
  note?: string | null;
}) {
  const review = await prisma.catalogReview.findUnique({ where: { id: input.reviewId } });
  if (!review) throw new NotFoundError('No encontré la ficha');
  const outcome = applyReview(input.action, review, input.canonicalId, input.note);
  await prisma.storeListing.update({
    where: { id: review.listingId },
    data: outcome.listing,
  });
  await prisma.catalogReview.update({
    where: { id: review.id },
    data: { ...outcome.review, resolvedBy: userId },
  });
  return { status: outcome.review.status };
}
