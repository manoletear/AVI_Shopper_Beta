import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/responses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ImportRow {
  productName: string;
  brand?: string;
  category?: string;
  storeSlug?: string;
  storeName?: string;
  price?: number;
  quantity?: number;
  unit?: string;
  baseAmount?: number;
  baseUnit?: string;
  groupKey?: string;
  orderRef?: string;
  purchasedAt: string;
}

/**
 * POST /api/families/import-history
 * Importa historial de compras en JSON.
 * Acepta un array de productos con fecha de compra.
 *
 * El usuario debe pertenecer a una familia activa.
 * source se marca como "import" para distinguir de compras manuales.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    const member = await prisma.familyMember.findFirst({
      where: { userId, isActive: true },
      select: { familyId: true },
    });
    if (!member) return errorResponse('No tienes una familia. Crea una primero en /api/families/setup', 400);

    const body = await request.json();
    const rows: ImportRow[] = Array.isArray(body) ? body : body.purchases || body.items || [];

    if (!rows.length) return errorResponse('No hay compras para importar', 400);
    if (rows.length > 5000) return errorResponse('Máximo 5.000 compras por importación', 400);

    const data = rows
      .filter((r) => r.productName && r.purchasedAt)
      .map((r) => ({
        userId,
        familyId: member.familyId,
        productName: r.productName,
        brand: r.brand || null,
        category: r.category || null,
        storeSlug: r.storeSlug || null,
        storeName: r.storeName || null,
        price: r.price ? Math.round(r.price) : null,
        quantity: r.quantity || 1,
        unit: r.unit || null,
        baseAmount: r.baseAmount || null,
        baseUnit: r.baseUnit || null,
        groupKey: r.groupKey || null,
        orderRef: r.orderRef || null,
        source: 'import' as const,
        purchasedAt: new Date(r.purchasedAt),
      }));

    const result = await prisma.purchaseHistory.createMany({ data });

    return successResponse({
      imported: result.count,
      familyId: member.familyId,
      message: `${result.count} compras importadas. AVI ya puede analizar tu despensa.`,
    });
  } catch (error: any) {
    console.error('Import history error:', error);
    return errorResponse(error.message || 'Error al importar', error.statusCode || 500);
  }
}
