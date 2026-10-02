import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { comparePrices } from '@/services/apify-price.service';
import { scoreProductHealth, matchProducts } from '@/services/typesafe-decision.service';
import { savePriceObservations, getLatestPrices } from '@/services/price-observation.service';

// GET /api/prices?q=leche+colun&analyze=true&cached=true
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const analyze = searchParams.get('analyze') === 'true';
    const useCached = searchParams.get('cached') === 'true';

    if (!query) {
      return errorResponse('Parámetro "q" requerido', 400, 'MISSING_QUERY');
    }

    // Si cached=true, buscar precios recientes en DB (menos de 12 horas)
    if (useCached) {
      const cached = await getLatestPrices(query, 12);
      if (cached.length > 0) {
        const cheapest = cached.reduce((min, p) => (p.price < min.price ? p : min));
        return successResponse({
          query,
          totalResults: cached.length,
          cheapest,
          results: cached,
          source: 'cache',
          maxAgeHours: Math.max(...cached.map((c) => c.hoursAgo)),
          scrapedAt: cached[0].observedAt,
        });
      }
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      // Fallback: buscar en cache aunque no se pidio
      const cached = await getLatestPrices(query, 24);
      if (cached.length > 0) {
        const cheapest = cached.reduce((min, p) => (p.price < min.price ? p : min));
        return successResponse({
          query,
          totalResults: cached.length,
          cheapest,
          results: cached,
          source: 'cache',
          maxAgeHours: Math.max(...cached.map((c) => c.hoursAgo)),
        });
      }
      return errorResponse(
        'APIFY_API_TOKEN no configurado. Agrega tu token en .env',
        503,
        'APIFY_NOT_CONFIGURED'
      );
    }

    // Buscar precios reales
    const comparison = await comparePrices(query, apifyToken);

    // Analizar salud con TypeSafe si se pide
    let healthAnalysis: Array<{
      name: string;
      store: string;
      price: number;
      healthLevel: string;
      healthScore: number;
      isUltraProcessed: boolean;
    }> = [];

    const typesafeKey = process.env.TYPESAFE_API_KEY;
    if (analyze && typesafeKey && comparison.results.length > 0) {
      // Analizar los primeros 5 productos (para no saturar la API)
      const toAnalyze = comparison.results.slice(0, 5);
      for (const product of toAnalyze) {
        try {
          const health = await scoreProductHealth(
            { name: product.name, brand: product.brand, category: product.categories },
            typesafeKey
          );
          healthAnalysis.push({
            name: product.name,
            store: product.store,
            price: product.price,
            healthLevel: health.healthLevel,
            healthScore: health.score,
            isUltraProcessed: health.isUltraProcessed,
          });
        } catch {
          healthAnalysis.push({
            name: product.name,
            store: product.store,
            price: product.price,
            healthLevel: 'No analizado',
            healthScore: 50,
            isUltraProcessed: false,
          });
        }
      }
    }

    return successResponse({
      query,
      totalResults: comparison.results.length,
      cheapest: comparison.cheapest,
      byStore: {
        jumbo: comparison.results.filter((r) => r.store === 'Jumbo'),
        lider: comparison.results.filter((r) => r.store === 'Lider'),
        unimarc: comparison.results.filter((r) => r.store === 'Unimarc'),
      },
      healthAnalysis: analyze ? healthAnalysis : undefined,
      source: 'live',
      scrapedAt: comparison.scrapedAt,
    });

    // Guardar precios observados en background (no bloquea respuesta)
    savePriceObservations(
      comparison.results.map((r) => ({
        productName: r.name,
        brand: r.brand,
        storeSlug: r.store.toLowerCase(),
        storeName: r.store,
        price: r.price,
        listPrice: r.listPrice,
        inStock: r.inStock,
        url: r.url,
        imageUrl: r.imageUrl,
        searchTerm: query!,
      }))
    ).catch(() => {});
  } catch (error: any) {
    console.error('Price search error:', error);
    return errorResponse(error.message || 'Error al buscar precios', 500);
  }
}

// POST /api/prices/compare — Compara lista de productos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return errorResponse('Lista de productos requerida', 400);
    }

    if (products.length > 10) {
      return errorResponse('Máximo 10 productos por consulta', 400);
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return errorResponse('APIFY_API_TOKEN no configurado', 503);
    }

    const typesafeKey = process.env.TYPESAFE_API_KEY;
    const results: Array<{
      product: string;
      jumbo: { name: string; price: number } | null;
      lider: { name: string; price: number } | null;
      cheapestStore: string | null;
      savings: number;
      isMatch?: boolean;
    }> = [];

    let totalSavingsJumbo = 0;
    let totalSavingsLider = 0;
    let totalSavingsSplit = 0;

    for (const product of products) {
      const comparison = await comparePrices(product, apifyToken);

      const jumboItem = comparison.results.find((r) => r.store === 'Jumbo');
      const liderItem = comparison.results.find((r) => r.store === 'Lider');

      // Verificar que son el mismo producto con TypeSafe
      let isMatch: boolean | undefined;
      if (jumboItem && liderItem && typesafeKey) {
        try {
          const match = await matchProducts(
            { name: jumboItem.name, brand: jumboItem.brand, store: 'Jumbo' },
            { name: liderItem.name, brand: liderItem.brand, store: 'Lider' },
            typesafeKey
          );
          isMatch = match.isMatch;
        } catch {
          isMatch = undefined;
        }
      }

      const cheapestPrice = Math.min(
        jumboItem?.price ?? Infinity,
        liderItem?.price ?? Infinity
      );
      const mostExpensive = Math.max(
        jumboItem?.price ?? 0,
        liderItem?.price ?? 0
      );

      if (jumboItem) totalSavingsJumbo += jumboItem.price;
      if (liderItem) totalSavingsLider += liderItem.price;
      if (cheapestPrice < Infinity) totalSavingsSplit += cheapestPrice;

      results.push({
        product,
        jumbo: jumboItem ? { name: jumboItem.name, price: jumboItem.price } : null,
        lider: liderItem ? { name: liderItem.name, price: liderItem.price } : null,
        cheapestStore:
          cheapestPrice === Infinity
            ? null
            : jumboItem && jumboItem.price === cheapestPrice
            ? 'Jumbo'
            : 'Lider',
        savings: mostExpensive - cheapestPrice,
        isMatch,
      });

      await new Promise((r) => setTimeout(r, 1500));
    }

    return successResponse({
      results,
      summary: {
        totalJumbo: totalSavingsJumbo,
        totalLider: totalSavingsLider,
        totalSplit: totalSavingsSplit,
        bestSingleStore:
          totalSavingsJumbo <= totalSavingsLider ? 'Jumbo' : 'Lider',
        savingsWithSplit: Math.min(totalSavingsJumbo, totalSavingsLider) - totalSavingsSplit,
      },
      productsCompared: products.length,
      scrapedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Price comparison error:', error);
    return errorResponse(error.message || 'Error al comparar precios', 500);
  }
}
