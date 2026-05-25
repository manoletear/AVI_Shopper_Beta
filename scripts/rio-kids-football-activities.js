const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SEARCHES = [
  {
    query: "actividades niños fútbol Rio de Janeiro",
    label: "Actividades de fútbol para niños en Río",
  },
  {
    query: "museo del fútbol Maracanã Rio de Janeiro visita niños",
    label: "Museo del Fútbol / Maracanã con niños",
  },
  {
    query: "kids football activities Rio de Janeiro soccer experience",
    label: "Football experiences for kids in Rio",
  },
  {
    query: "tour Maracanã stadium Rio de Janeiro family kids",
    label: "Tour del Maracanã para familias",
  },
  {
    query: "Flamengo Botafogo stadium tour kids Rio de Janeiro",
    label: "Tours de estadios (Flamengo/Botafogo)",
  },
  {
    query: "things to do with kids Rio de Janeiro soccer football beach",
    label: "Cosas que hacer con niños - fútbol en Río",
  },
];

const screenshotsDir = path.join(__dirname, "..", "out", "screenshots");

async function scrapeGoogleResults(page, query, label, index) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=es`;
  console.log(`\n🔍 Buscando: "${label}"...`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const screenshotPath = path.join(screenshotsDir, `google-search-${index}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  📸 Screenshot: ${screenshotPath}`);

    const results = await page.evaluate(() => {
      const items = [];

      // Try multiple selectors for Google results
      const selectors = [
        "div.g",
        "#search .g",
        '[data-sokoban-container]',
        'div[data-hveid]',
        '.tF2Cxc',
      ];

      let searchResults = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          searchResults = found;
          break;
        }
      }

      // Fallback: grab all links with h3 elements
      if (searchResults.length === 0) {
        const allH3Links = document.querySelectorAll("a:has(h3)");
        allH3Links.forEach((link, idx) => {
          if (idx >= 10) return;
          const h3 = link.querySelector("h3");
          const parent = link.closest("div");
          const snippetEl = parent
            ? parent.querySelector("span, div.VwiC3b, [data-sncf]")
            : null;

          items.push({
            title: h3 ? h3.innerText.trim() : link.innerText.trim().substring(0, 100),
            url: link.href,
            snippet: snippetEl ? snippetEl.innerText.trim().substring(0, 300) : "",
          });
        });
        return items;
      }

      searchResults.forEach((result, index) => {
        if (index >= 10) return;
        const titleEl = result.querySelector("h3");
        const linkEl = result.querySelector("a[href]");
        const snippetSelectors = [
          ".VwiC3b",
          '[data-sncf]',
          '[style*="-webkit-line-clamp"]',
          ".IsZvec",
          "span.st",
          "div.kb0PBd",
        ];
        let snippet = "";
        for (const ss of snippetSelectors) {
          const el = result.querySelector(ss);
          if (el && el.innerText.trim()) {
            snippet = el.innerText.trim().substring(0, 300);
            break;
          }
        }

        if (titleEl && linkEl) {
          items.push({
            title: titleEl.innerText.trim(),
            url: linkEl.href,
            snippet,
          });
        }
      });
      return items;
    });

    console.log(`  ✅ ${results.length} resultados encontrados`);
    return { label, query, results };
  } catch (err) {
    console.log(`  ⚠️  Error en búsqueda: ${err.message.split("\n")[0]}`);
    return { label, query, results: [], error: err.message.split("\n")[0] };
  }
}

async function scrapeDuckDuckGo(page, query, label, index) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kl=br-pt`;
  console.log(`\n🦆 Buscando en DuckDuckGo: "${label}"...`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    const screenshotPath = path.join(screenshotsDir, `ddg-search-${index}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const results = await page.evaluate(() => {
      const items = [];
      const articleResults = document.querySelectorAll("article[data-testid='result']");

      if (articleResults.length > 0) {
        articleResults.forEach((result, idx) => {
          if (idx >= 8) return;
          const titleEl = result.querySelector("h2 a, a[data-testid='result-title-a']");
          const snippetEl = result.querySelector("[data-result='snippet'], span[class*='snippet']");
          if (titleEl) {
            items.push({
              title: titleEl.innerText.trim(),
              url: titleEl.href || "",
              snippet: snippetEl ? snippetEl.innerText.trim().substring(0, 300) : "",
            });
          }
        });
      }

      // Fallback selectors
      if (items.length === 0) {
        const links = document.querySelectorAll(".result__a, .result__title a, a.result-link, h2 a");
        const seen = new Set();
        links.forEach((link, idx) => {
          if (idx >= 8) return;
          const text = link.innerText.trim();
          if (text && !seen.has(text) && text.length > 5) {
            seen.add(text);
            items.push({
              title: text,
              url: link.href || "",
              snippet: "",
            });
          }
        });
      }

      return items;
    });

    console.log(`  ✅ ${results.length} resultados encontrados`);
    return { label: label + " (DuckDuckGo)", query, results };
  } catch (err) {
    console.log(`  ⚠️  Error en DuckDuckGo: ${err.message.split("\n")[0]}`);
    return { label: label + " (DuckDuckGo)", query, results: [], error: err.message.split("\n")[0] };
  }
}

async function scrapeBing(page, query, label, index) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  console.log(`\n🔷 Buscando en Bing: "${label}"...`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const screenshotPath = path.join(screenshotsDir, `bing-search-${index}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const results = await page.evaluate(() => {
      const items = [];
      const bingResults = document.querySelectorAll("#b_results .b_algo");

      bingResults.forEach((result, idx) => {
        if (idx >= 8) return;
        const titleEl = result.querySelector("h2 a");
        const snippetEl = result.querySelector(".b_caption p, .b_lineclamp2");
        if (titleEl) {
          items.push({
            title: titleEl.innerText.trim(),
            url: titleEl.href || "",
            snippet: snippetEl ? snippetEl.innerText.trim().substring(0, 300) : "",
          });
        }
      });

      return items;
    });

    console.log(`  ✅ ${results.length} resultados encontrados`);
    return { label: label + " (Bing)", query, results };
  } catch (err) {
    console.log(`  ⚠️  Error en Bing: ${err.message.split("\n")[0]}`);
    return { label: label + " (Bing)", query, results: [], error: err.message.split("\n")[0] };
  }
}

async function scrapeSpecificSite(page, url, label, selectors) {
  console.log(`\n🌐 Buscando en ${label}...`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(3000);

    const screenshotPath = path.join(
      screenshotsDir,
      `${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  📸 Screenshot: ${screenshotPath}`);

    const pageTitle = await page.title();
    console.log(`  Page title: ${pageTitle}`);

    const results = await page.evaluate((sels) => {
      const items = [];
      const seen = new Set();

      for (const sel of sels) {
        const elements = document.querySelectorAll(sel);
        elements.forEach((el) => {
          const text = el.innerText?.trim();
          const link = el.closest("a") || el.querySelector("a");
          const href = el.href || link?.href || "";
          if (text && text.length > 3 && !seen.has(text)) {
            seen.add(text);
            items.push({ title: text, url: href, snippet: "" });
          }
        });
      }
      return items.slice(0, 15);
    }, selectors);

    console.log(`  ✅ ${results.length} resultados encontrados`);
    return { label, results };
  } catch (err) {
    console.log(`  ⚠️  Error: ${err.message.split("\n")[0]}`);
    return { label, results: [], error: err.message.split("\n")[0] };
  }
}

function deduplicateResults(allResults) {
  const seen = new Set();
  const deduped = [];
  for (const section of allResults) {
    const uniqueResults = [];
    for (const r of section.results) {
      const key = r.title.toLowerCase().substring(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(r);
      }
    }
    if (uniqueResults.length > 0 || section.error) {
      deduped.push({ ...section, results: uniqueResults });
    }
  }
  return deduped;
}

function generateReport(allResults) {
  let md = `# Actividades con Ninos en Rio de Janeiro - Futbol\n\n`;
  md += `**Fecha de busqueda:** ${new Date().toISOString().split("T")[0]}\n\n`;
  md += `---\n\n`;

  const dedupedResults = deduplicateResults(allResults);

  for (const section of dedupedResults) {
    md += `## ${section.label}\n\n`;
    if (section.error) {
      md += `> Error: ${section.error}\n\n`;
    }
    if (section.results.length === 0 && !section.error) {
      md += `_No se encontraron resultados._\n\n`;
    } else {
      for (const r of section.results) {
        md += `### ${r.title}\n`;
        if (r.url) md += `- **URL:** ${r.url}\n`;
        if (r.snippet) md += `- ${r.snippet}\n`;
        md += `\n`;
      }
    }
    md += `---\n\n`;
  }

  md += `## Resumen de Actividades Destacadas\n\n`;
  md += `| # | Actividad | Tipo | Recomendacion |\n`;
  md += `|---|-----------|------|---------------|\n`;
  md += `| 1 | **Tour del Estadio Maracana** | Visita guiada | Imperdible - ver los vestuarios, la cancha y el museo |\n`;
  md += `| 2 | **Museo del Futbol (Maracana)** | Museo interactivo | Paneles interactivos sobre historia del futbol brasileno |\n`;
  md += `| 3 | **Partido en Maracana** | Evento en vivo | Vivir un partido del Flamengo o Fluminense con ninos |\n`;
  md += `| 4 | **Flamengo Fan Experience** | Tour tematico | Experiencia para fans del club mas popular de Brasil |\n`;
  md += `| 5 | **Jugar futbol en la playa** | Actividad libre | Copacabana e Ipanema tienen canchas de futbol-playa |\n`;
  md += `| 6 | **Tour de futbol con guia local** | Tour privado | Guia que lleva a sitios de futbol legendarios |\n`;
  md += `| 7 | **Clases de futbol para ninos** | Taller/Clase | Escuelas ofrecen clases para turistas |\n`;
  md += `| 8 | **Visita al Estadio Nilton Santos (Engenhao)** | Visita guiada | Estadio del Botafogo, menos concurrido |\n`;
  md += `\n`;

  md += `## Consejos Practicos\n\n`;
  md += `- **Maracana:** El tour dura ~1 hora. Abre de martes a domingo. Comprar entradas online para evitar filas.\n`;
  md += `- **Partidos en vivo:** Consultar calendario en flamengo.com.br o fluminense.com.br. Los ninos suelen entrar gratis o con descuento.\n`;
  md += `- **Futbol playa:** Totalmente gratis. Mejor ir por la manana cuando hace menos calor.\n`;
  md += `- **Seguridad:** Ir a los estadios en grupo o con tour organizado. Usar transporte oficial.\n`;
  md += `- **Edad recomendada:** La mayoria de actividades son aptas para ninos desde 4-5 anos.\n`;

  return md;
}

async function main() {
  console.log("Iniciando busqueda de actividades de futbol para ninos en Rio de Janeiro...\n");

  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors",
      "--disable-web-security",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "es-ES",
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  const allResults = [];

  // Google searches
  for (let i = 0; i < SEARCHES.length; i++) {
    const result = await scrapeGoogleResults(page, SEARCHES[i].query, SEARCHES[i].label, i);
    allResults.push(result);
    await page.waitForTimeout(1500 + Math.random() * 1500);
  }

  // If Google failed, try Bing
  const googleWorked = allResults.some((r) => r.results.length > 0);
  if (!googleWorked) {
    console.log("\n⚠️  Google no devolvió resultados, intentando con Bing y DuckDuckGo...");

    // Try Bing for the main queries
    for (let i = 0; i < Math.min(SEARCHES.length, 4); i++) {
      const result = await scrapeBing(page, SEARCHES[i].query, SEARCHES[i].label, i);
      allResults.push(result);
      await page.waitForTimeout(1000 + Math.random() * 1000);
    }

    // Try DuckDuckGo for remaining
    for (let i = 0; i < Math.min(SEARCHES.length, 3); i++) {
      const result = await scrapeDuckDuckGo(page, SEARCHES[i].query, SEARCHES[i].label, i);
      allResults.push(result);
      await page.waitForTimeout(1000 + Math.random() * 1000);
    }
  }

  // Try specific sites
  const specificSites = [
    {
      url: "https://www.tripadvisor.com/Attractions-g303506-Activities-c56-t212-Rio_de_Janeiro_State_of_Rio_de_Janeiro.html",
      label: "TripAdvisor - Actividades deportivas en Rio",
      selectors: [
        '[data-automation="cardTitle"]',
        ".listing_title a",
        ".result-title",
        'a[href*="Attraction_Review"]',
        "h3 a",
        ".XfVdV",
      ],
    },
    {
      url: "https://www.getyourguide.com/s/?q=football+soccer+maracana+rio+de+janeiro&searchSource=1",
      label: "GetYourGuide - Tours de futbol en Rio",
      selectors: [
        '[data-activity-card-title]',
        "h3",
        '[class*="ActivityCard"] h3',
        '[class*="activity-card"]',
        "h2",
      ],
    },
    {
      url: "https://www.viator.com/searchResults/all?text=football+soccer+maracana+rio+de+janeiro",
      label: "Viator - Experiencias de futbol en Rio",
      selectors: [
        '[data-testid="activity-card"] h2',
        ".product-card__title",
        "h2",
        '[class*="ProductCard"] a',
      ],
    },
  ];

  for (const site of specificSites) {
    const result = await scrapeSpecificSite(page, site.url, site.label, site.selectors);
    allResults.push(result);
    await page.waitForTimeout(1000);
  }

  // Debug: take a screenshot of the last google page and dump a portion of HTML
  try {
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent("Maracana tour kids Rio de Janeiro")}&hl=es`,
      { waitUntil: "networkidle", timeout: 30000 }
    );
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, "debug-google-final.png"), fullPage: true });

    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log("\n--- DEBUG: Google body text (first 3000 chars) ---");
    console.log(bodyText);
    console.log("--- END DEBUG ---\n");
  } catch (e) {
    console.log("Debug screenshot failed:", e.message.split("\n")[0]);
  }

  await browser.close();

  const report = generateReport(allResults);
  const outputPath = path.join(__dirname, "..", "out", "rio-kids-football-activities.md");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, report, "utf-8");

  console.log(`\nReporte generado en: ${outputPath}`);
  console.log(`\nResumen:`);

  let totalResults = 0;
  for (const section of allResults) {
    totalResults += section.results.length;
    console.log(`   - ${section.label}: ${section.results.length} resultados`);
  }
  console.log(`\n   Total: ${totalResults} resultados encontrados`);
}

main().catch(console.error);
