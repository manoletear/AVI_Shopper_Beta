import { PrismaClient } from '@prisma/client';
import { LABELED_PRODUCTS, SUBSTITUTE_PAIRS } from './examples';
import { normalizeName } from './normalize';

const LISTINGS: Array<{
  productKey: string;
  storeSlug: string;
  storeName: string;
  rawName: string;
  ean?: string;
  price: number;
  status: 'matched' | 'pending';
  method: 'ean' | 'rules' | 'ai';
  confidence: number;
  reason?: string;
}> = [
  { productKey: 'soprole-1', storeSlug: 'lider', storeName: 'Lider', rawName: 'Leche Entera Soprole 1L', ean: '7802900000011', price: 1090, status: 'matched', method: 'ean', confidence: 1 },
  { productKey: 'soprole-1', storeSlug: 'jumbo', storeName: 'Jumbo', rawName: 'Leche Soprole Entera 1 L', ean: '7802900000011', price: 1190, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'soprole-6', storeSlug: 'tottus', storeName: 'Tottus', rawName: 'Leche Soprole Entera 6x1 L', price: 5990, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'colun-1', storeSlug: 'unimarc', storeName: 'Unimarc', rawName: 'Leche Colun 1L', ean: '7801234000018', price: 990, status: 'matched', method: 'ean', confidence: 1 },
  { productKey: 'lomo-granel', storeSlug: 'jumbo', storeName: 'Jumbo', rawName: 'Lomo vetado Cat-V granel', price: 42990, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'lomo-vacio', storeSlug: 'lider', storeName: 'Lider', rawName: 'Lomo vetado Cat-V al vacío 500 g', price: 24990, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'entrana', storeSlug: 'lider', storeName: 'Lider', rawName: 'Entraña', price: 39990, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'entranita', storeSlug: 'tottus', storeName: 'Tottus', rawName: 'Entrañita', price: 28000, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'carbon', storeSlug: 'tottus', storeName: 'Tottus', rawName: 'Carbon Vegetal 2.5kg', price: 3990, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'papel', storeSlug: 'jumbo', storeName: 'Jumbo', rawName: 'Papel Higienico Elite 12 un', price: 4590, status: 'matched', method: 'rules', confidence: 0.98 },
  { productKey: 'pan-int', storeSlug: 'lider', storeName: 'Lider', rawName: 'Pan de molde integral Ideal 580g', price: 2190, status: 'matched', method: 'rules', confidence: 0.98 },
  {
    productKey: 'soprole-1',
    storeSlug: 'santa-isabel',
    storeName: 'Santa Isabel',
    rawName: 'Leche entera Soproel 1L',
    price: 1350,
    status: 'pending',
    method: 'ai',
    confidence: 0.62,
    reason: 'Se parece a la Leche Soprole Entera 1 L, pero la marca está mal escrita. Hay que confirmarlo.',
  },
];

export async function seedCanonicalCatalog(db: PrismaClient) {
  await db.catalogReview.deleteMany();
  await db.productSubstitute.deleteMany();
  await db.storeListing.deleteMany();
  await db.canonicalProduct.deleteMany();

  const ids = new Map<string, string>();
  for (const product of LABELED_PRODUCTS) {
    const norm = normalizeName(product.name, product.ean);
    const row = await db.canonicalProduct.create({
      data: {
        name: product.name,
        brand: norm.brand,
        category: norm.category,
        variant: norm.variant,
        sizeAmount: norm.sizeAmount,
        sizeUnit: norm.sizeUnit,
        packCount: norm.packCount,
        soldByWeight: norm.soldByWeight,
        minPurchase: product.minPurchase,
        stepAmount: product.stepAmount,
        ean: norm.ean,
      },
    });
    ids.set(product.id, row.id);
  }

  for (const listing of LISTINGS) {
    const norm = normalizeName(listing.rawName, listing.ean);
    const canonicalId = ids.get(listing.productKey) || null;
    const row = await db.storeListing.create({
      data: {
        storeSlug: listing.storeSlug,
        storeName: listing.storeName,
        rawName: listing.rawName,
        ean: norm.ean,
        price: listing.price,
        brand: norm.brand,
        category: norm.category,
        variant: norm.variant,
        sizeAmount: norm.sizeAmount,
        sizeUnit: norm.sizeUnit,
        packCount: norm.packCount,
        soldByWeight: norm.soldByWeight,
        canonicalId: listing.status === 'matched' ? canonicalId : null,
        matchMethod: listing.method,
        matchConfidence: listing.confidence,
        matchStatus: listing.status,
      },
    });
    if (listing.status === 'pending') {
      await db.catalogReview.create({
        data: {
          listingId: row.id,
          suggestedId: canonicalId,
          confidence: listing.confidence,
          reason: listing.reason || 'Parecido bajo',
          status: 'pending',
        },
      });
    }
  }

  for (const pair of SUBSTITUTE_PAIRS) {
    const fromId = ids.get(pair.from);
    const toId = ids.get(pair.to);
    if (!fromId || !toId) continue;
    await db.productSubstitute.create({ data: { fromId, toId, reason: pair.reason, note: pair.note } });
    await db.productSubstitute.create({ data: { fromId: toId, toId: fromId, reason: pair.reason, note: pair.note } });
  }
}
