import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { comparePrices, expandQuery } from '@/services/apify-price.service';
import { priceQuery } from '@/services/offer-pricing';
import { matchProducts } from '@/services/typesafe-decision.service';
import { savePriceObservations, getLatestPrices } from '@/services/price-observation.service';

// GET /api/prices?q=leche+colun&analyze=true&cached=true
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
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

    // 1. Try cache first
    const cached = await getLatestPrices(query, 24);
    if (cached.length > 0) {
      const cheapest = cached.reduce((min, p) => (p.price < min.price ? p : min));
      return successResponse({
        query, totalResults: cached.length, cheapest, results: cached,
        source: 'cache', maxAgeHours: Math.max(...cached.map((c) => c.hoursAgo)),
      });
    }

    // 2. Try Apify live search
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (apifyToken) {
      const comparison = await comparePrices(query, apifyToken);

      if (comparison.results.length > 0) {
        // Save to cache
        savePriceObservations(
          comparison.results.map((r) => ({
            productName: r.name, brand: r.brand,
            storeSlug: r.store.toLowerCase(), storeName: r.store,
            price: r.price, listPrice: r.listPrice, inStock: r.inStock,
            url: r.url, imageUrl: r.imageUrl, searchTerm: query!,
          }))
        ).catch(() => {});

        return successResponse({
          query,
          totalResults: comparison.results.length,
          cheapest: comparison.cheapest,
          byStore: {
            jumbo: comparison.results.filter((r) => r.store === 'Jumbo'),
            lider: comparison.results.filter((r) => r.store === 'Lider'),
            unimarc: comparison.results.filter((r) => r.store === 'Unimarc'),
            tottus: comparison.results.filter((r) => r.store === 'Tottus'),
          },
          source: 'live',
          scrapedAt: comparison.scrapedAt,
        });
      }
    }

    // 3. No results — return demo data for MVP
    const demoProducts = generateDemoResults(query);
    if (demoProducts.length > 0) {
      const cheapest = priceQuery(query, demoProducts).cheapest;
      return successResponse({
        query, totalResults: demoProducts.length, cheapest,
        byStore: {
          jumbo: demoProducts.filter((r) => r.store === 'Jumbo'),
          lider: demoProducts.filter((r) => r.store === 'Lider'),
          unimarc: demoProducts.filter((r) => r.store === 'Unimarc'),
          tottus: demoProducts.filter((r) => r.store === 'Tottus'),
        },
        source: 'demo',
      });
    }

    return successResponse({ query, totalResults: 0, cheapest: null, results: [], source: 'empty' });
  } catch (error: any) {
    console.error('Price search error:', error);
    return errorResponse(error.message || 'Error al buscar precios', 500);
  }
}

function generateDemoResults(query: string) {
  const asked = query.toLowerCase();
  if (/lomo vetado|entraña|entrana/.test(asked)) {
    const cut = /entrana|entraña/.test(asked) ? 'Entraña' : 'Lomo vetado';
    return [
      { name: cut, brand: '', store: 'Tottus', price: 35605, inStock: true },
      { name: cut, brand: '', store: 'Lider', price: 39990, inStock: true },
      { name: cut, brand: '', store: 'Jumbo', price: 42990, inStock: true },
      { name: `${cut} bandeja 1 kg`, brand: '', store: 'Unimarc', price: 45990, inStock: true },
    ];
  }
  const expanded = expandQuery(query);
  const q = expanded.toLowerCase();
  const stores = ['Jumbo', 'Lider', 'Unimarc', 'Tottus'];
  const baseProducts: Record<string, { name: string; basePrice: number }> = {
    leche: { name: 'Leche Entera 1L', basePrice: 1090 },
    pan: { name: 'Pan Molde Integral', basePrice: 2190 },
    huevo: { name: 'Huevos 12 un', basePrice: 3490 },
    arroz: { name: 'Arroz Grado 1 1kg', basePrice: 1390 },
    pollo: { name: 'Pollo Entero', basePrice: 4490 },
    carne: { name: 'Carne Molida 500g', basePrice: 3990 },
    carbon: { name: 'Carbon Vegetal 2.5kg', basePrice: 3990 },
    coca: { name: 'Coca-Cola 1.5L', basePrice: 1690 },
    detergente: { name: 'Detergente Liquido 3L', basePrice: 5990 },
    cloro: { name: 'Cloro 1L', basePrice: 1290 },
    queso: { name: 'Queso Laminado 250g', basePrice: 2890 },
    jamon: { name: 'Jamon de Cerdo 200g', basePrice: 2490 },
    mantequilla: { name: 'Mantequilla 250g', basePrice: 2790 },
    cafe: { name: 'Cafe Instantaneo 170g', basePrice: 4990 },
    yogurt: { name: 'Yogurt Pack 6 un', basePrice: 2690 },
    cerveza: { name: 'Cerveza Pack 6 latas', basePrice: 5490 },
    palta: { name: 'Palta Hass', basePrice: 1490 },
    tomate: { name: 'Tomate kg', basePrice: 1290 },
    lechuga: { name: 'Lechuga Hidroponica', basePrice: 990 },
    papel: { name: 'Papel Higienico 12 rollos', basePrice: 5990 },
    lavaloza: { name: 'Lavalozas 750ml', basePrice: 1790 },
    fideos: { name: 'Fideos Tallarin 400g', basePrice: 890 },
    aceite: { name: 'Aceite Vegetal 1L', basePrice: 2190 },
    azucar: { name: 'Azucar 1kg', basePrice: 1190 },
    harina: { name: 'Harina 1kg', basePrice: 990 },
  };

  const qWords = q.split(/\s+/);
  const match = Object.entries(baseProducts).find(([key]) =>
    qWords.some((w) => w.includes(key) || key.includes(w))
  );
  if (!match) return [];

  const [matchedKey, product] = match;
  const brandWords = qWords.filter((w) => w !== matchedKey && w.length > 2);
  const brand = brandWords.length > 0 ? brandWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
  const fullName = brand ? `${product.name} ${brand}` : product.name;

  return stores.map((store) => {
    const variation = 0.85 + Math.random() * 0.3;
    const price = Math.round(product.basePrice * variation / 10) * 10;
    return {
      name: fullName, brand, store, price,
      inStock: true, url: undefined, imageUrl: undefined,
    };
  });
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
