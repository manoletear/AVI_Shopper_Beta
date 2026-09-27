/**
 * Super Lider Scraper Service
 *
 * Scrapea super.lider.cl (supermercado, NO marketplace)
 * usando Apify RAG Web Browser para extraer precios reales.
 *
 * super.lider.cl usa plataforma Walmart con URLs:
 *   Busqueda: /search?q={query}
 *   Producto: /ip/{categoria}/{sku}
 */

interface LiderProduct {
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  savings?: number;
  pricePerUnit?: string;
  url: string;
  imageUrl?: string;
  inStock: boolean;
  store: 'Lider';
}

interface LiderSearchResult {
  query: string;
  products: LiderProduct[];
  scrapedAt: string;
  error?: string;
}

/**
 * Parsea el markdown de super.lider.cl y extrae productos con precios
 */
function parseMarkdown(markdown: string, query: string): LiderProduct[] {
  const products: LiderProduct[] = [];
  const lines = markdown.split('\n');

  let currentProduct: Partial<LiderProduct> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detectar link de producto: [Nombre](url)
    const productLink = line.match(/\[([^\]]+)\]\((https:\/\/super\.lider\.cl\/(?:ip|wapcrs)[^\)]+)\)/);
    if (productLink) {
      // Si hay producto anterior pendiente, guardarlo
      if (currentProduct.name && currentProduct.price) {
        products.push(currentProduct as LiderProduct);
      }

      // Extraer URL real del tracking redirect
      let url = productLink[2];
      const rdMatch = url.match(/rd=([^&]+)/);
      if (rdMatch) {
        url = decodeURIComponent(rdMatch[1]);
      }
      const ipMatch = url.match(/(\/ip\/[^\?&]+)/);
      if (ipMatch) {
        url = `https://super.lider.cl${ipMatch[1]}`;
      }

      currentProduct = {
        name: productLink[1],
        url,
        inStock: true,
        store: 'Lider',
        brand: '',
      };
      continue;
    }

    // Detectar precio: $3.290 o precio actual $3.290
    const priceMatch = line.match(/^\$([0-9.,]+)$/);
    const precioActualMatch = line.match(/precio actual \$([0-9.,]+)/);
    if ((priceMatch || precioActualMatch) && currentProduct.name && !currentProduct.price) {
      const priceText = priceMatch ? priceMatch[1] : precioActualMatch![1];
      currentProduct.price = parseInt(priceText.replace(/[.,]/g, ''));
      continue;
    }

    // Detectar precio anterior: $9.290 (despues de "Costaba")
    const costabaMatch = line.match(/Costaba \$([0-9.,]+)/);
    if (costabaMatch && currentProduct.name) {
      currentProduct.originalPrice = parseInt(costabaMatch[1].replace(/[.,]/g, ''));
      continue;
    }

    // Detectar ahorro: Ahorra $2.000
    const ahorroMatch = line.match(/Ahorra \$([0-9.,]+)/);
    if (ahorroMatch && currentProduct.name) {
      currentProduct.savings = parseInt(ahorroMatch[1].replace(/[.,]/g, ''));
      continue;
    }

    // Detectar precio por unidad: $349 x un
    const unitMatch = line.match(/\$([0-9.,]+) x un/);
    if (unitMatch && currentProduct.name) {
      currentProduct.pricePerUnit = `$${unitMatch[1]}/un`;
      continue;
    }

    // Detectar marca (linea simple antes del nombre del producto)
    // Las marcas aparecen como una linea sola justo antes del nombre repetido
    if (line && !line.startsWith('$') && !line.startsWith('[') && !line.startsWith('!') &&
        !line.includes('Agregar') && !line.includes('Patrocinado') && !line.includes('Rebaja') &&
        !line.includes('precio') && !line.includes('Ahorra') && !line.includes('Costaba') &&
        !line.includes('x un') && line.length < 40 && currentProduct.name && !currentProduct.brand) {
      // Verificar que la siguiente linea es el nombre del producto
      const nextLine = lines[i + 1]?.trim();
      if (nextLine === currentProduct.name) {
        currentProduct.brand = line;
      }
    }

    // Detectar imagen
    const imgMatch = line.match(/!\[[^\]]*\]\((https:\/\/i5\.walmartimages[^\)]+)\)/);
    if (imgMatch && currentProduct.name && !currentProduct.imageUrl) {
      currentProduct.imageUrl = imgMatch[1];
    }
  }

  // Ultimo producto
  if (currentProduct.name && currentProduct.price) {
    products.push(currentProduct as LiderProduct);
  }

  return products;
}

/**
 * Busca productos en super.lider.cl via Apify RAG Web Browser
 *
 * Requiere APIFY_API_TOKEN en .env
 */
export async function searchSuperLider(
  query: string,
  apiToken: string
): Promise<LiderSearchResult> {
  const APIFY_BASE = 'https://api.apify.com/v2';

  try {
    // Ejecutar RAG Web Browser contra super.lider.cl
    const runRes = await fetch(
      `${APIFY_BASE}/acts/apify~rag-web-browser/runs?waitForFinish=45`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          query: `https://super.lider.cl/search?q=${encodeURIComponent(query)}`,
          maxResults: 1,
          outputFormats: ['markdown'],
        }),
      }
    );

    if (!runRes.ok) throw new Error(`Apify run failed: ${runRes.status}`);
    const run = await runRes.json();

    const datasetId = run.data?.defaultDatasetId;
    if (!datasetId) throw new Error('No dataset returned');

    // Obtener markdown
    const itemsRes = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?clean=true&limit=1`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );

    if (!itemsRes.ok) throw new Error('Failed to fetch results');
    const items = await itemsRes.json();

    if (!items[0]?.markdown) {
      return { query, products: [], scrapedAt: new Date().toISOString(), error: 'No content returned' };
    }

    const products = parseMarkdown(items[0].markdown, query);

    return {
      query,
      products,
      scrapedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      query,
      products: [],
      scrapedAt: new Date().toISOString(),
      error: (e as Error).message,
    };
  }
}

/**
 * Busca multiples productos en super.lider.cl
 */
export async function searchSuperLiderBatch(
  queries: string[],
  apiToken: string
): Promise<Map<string, LiderSearchResult>> {
  const results = new Map<string, LiderSearchResult>();

  for (const query of queries) {
    const result = await searchSuperLider(query, apiToken);
    results.set(query, result);
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}
