# AVI Shopper — Conocimiento de Scraping de Supermercados Chilenos

## Fecha de investigacion: Septiembre 2026

---

## 1. JUMBO (Cencosud)

### Sitio: jumbo.cl
### Estado: FUNCIONAL via Apify

**Actor Apify**: `scraperschile/jumbo`
- Rating: 5/5, 33 usuarios
- Costo: $0.003 USD / producto
- Velocidad: ~3-5 segundos por busqueda

**API Interna descubierta (BFF)**:
- Endpoint: `POST https://bff.jumbo.cl/catalog/plp`
- API Key: `be-reg-groceries-jumbo-catalog-w54byfvkmju5`
- Headers requeridos: apikey, x-client-version, referer (jumbo.cl)
- Respuesta: JSON con productos, precios, imagenes, stock
- CloudFront bloquea requests directos (curl) — solo funciona desde browser

**API de sugerencias** (funciona con curl directo):
- `GET https://bff.jumbo.cl/catalog/search-suggestions?term=leche`
- Misma apikey
- Retorna: sugerencias de busqueda, marcas, categorias

**API de CMS (Cencosud)**:
- `https://sm-web-api.ecomm.cencosud.com/cms/api/v1/cms/datetime`
- `https://sm-web-api.ecomm.cencosud.com/cms/api/v1/cms/search-banner/{term}`
- Headers: x-consumer: jumbocl, x-e-commerce: jumbo, x-account: jumbocl, apikey: 6lNbggVdme5JFCegzLC

**Datos disponibles**: nombre, marca, precio oferta, precio lista, stock, categorias, URL, imagen, SKU, limite carrito, vendedor, marketplace flag

**Limitaciones**: El sitio es SPA — headless Chrome no renderiza productos (anti-bot). Solo funciona via actor Apify o interceptando BFF desde browser real.

---

## 2. SANTA ISABEL (Cencosud)

### Sitio: santaisabel.cl
### Estado: FUNCIONAL via Apify

**Actor Apify**: `automation-lab/chile-supermarket-price-comparison`
- Soporta: Jumbo + Santa Isabel
- Costo: $0.0016 USD / producto
- Input: queries (array), stores: ["jumbo", "santa-isabel"]

**Misma infraestructura que Jumbo** (ambos son Cencosud):
- Probablemente usa la misma API BFF con diferente consumer ID
- El actor normaliza datos y permite comparacion cruzada con matchKey

**Datos disponibles**: query, store, productId, matchKey, productName, brand, currentPriceClp, regularPriceClp, availability, availableQuantity, productUrl, imageUrl, matchedAcrossStores

---

## 3. LIDER (Walmart Chile)

### Sitios:
- **super.lider.cl** = SUPERMERCADO (groceries) ← el que importa
- **lider.cl** = MARKETPLACE (electrodomesticos, ropa, tech)

### Estado: PARCIAL — solo marketplace

**Actor Apify**: `scraperschile/lider-cl`
- Rating: 5/5, 55 usuarios
- Costo: $0.003 USD / producto
- **PROBLEMA**: Apunta a lider.cl (marketplace), NO a super.lider.cl (supermercado)
- Buscar "huevos" retorna canastos y hervidores, no huevos de gallina
- Buscar "mantequilla" retorna portavelas y accesorios

**Tecnico**:
- Usa GraphQL catalog endpoint del marketplace
- seller_type: "INTERNAL" (Lider directo) vs "EXTERNAL" (marketplace sellers)
- Incluso items INTERNAL son de marketplace, no supermercado

**super.lider.cl** (supermercado):
- URL de ejemplo: `https://super.lider.cl/content/productos-a-mil/96311243`
- NO hay actor de Apify para este dominio (verificado Sep 2026)
- El sitio redirige a /blocked con headless Chrome
- Necesita actor custom o partnership

---

## 4. UNIMARC

### Sitio: unimarc.cl
### Estado: NO FUNCIONAL

- Plataforma VTEX (historicamente)
- URL de busqueda retorna 404: `/buscar?q=leche`
- API VTEX bloqueada: `api/catalog_system/pub/products/search` → 403
- No hay actor de Apify dedicado

---

## 5. KNASTA.CL (comparador)

### Estado: BLOQUEADO
- 403 Forbidden en cualquier request (curl o Playwright)
- Podria funcionar con proxies residenciales

---

## 6. RAPPI CHILE

### Estado: BLOQUEADO
- API: `services.rappi.cl/api/search-consumer/search` → 403 "PATH_NOT_ALLOWED"
- Hay actor Apify `solidcode/rappi-scraper` pero es para restaurantes, no supermercados

---

## 7. OPEN FOOD FACTS

### Estado: FUNCIONAL (productos, NO precios)
- API: `world.openfoodfacts.org/cgi/search.pl?search_terms=X&json=1&cc=cl`
- Sin autenticacion, sin limites agresivos
- 44 resultados para "leche colun"
- Datos: nombre, marca, categorias, alergenos, nutricion (calorias, proteina, grasa, etc)
- NO tiene precios — es catalogo de productos
- Util para: enriquecer productos con datos nutricionales y de alergenos

---

## RESUMEN DE FUENTES VIABLES

| Fuente | Supermercado | Precios | Nutricion | Estado |
|--------|-------------|---------|-----------|--------|
| Apify scraperschile/jumbo | Jumbo | SI | NO | FUNCIONAL |
| Apify automation-lab/chile-supermarket-price-comparison | Jumbo + Santa Isabel | SI | NO | FUNCIONAL |
| Apify scraperschile/lider-cl | Lider MARKETPLACE (no super) | SI pero no grocery | NO | PARCIAL |
| Open Food Facts API | Todos (catalogo) | NO | SI | FUNCIONAL |
| Knasta.cl | Todos | SI | NO | BLOQUEADO |
| Rappi API | N/A | N/A | N/A | BLOQUEADO |
| super.lider.cl | Lider Supermercado | SI | NO | SIN SCRAPER |
| unimarc.cl | Unimarc | SI | NO | BLOQUEADO |

## COSTOS APIFY (Free tier)

- Jumbo: ~$0.003/producto = $0.30 por 100 productos
- Santa Isabel: ~$0.0016/producto = $0.16 por 100 productos  
- Comparar lista de 10 productos en 2 tiendas: ~$0.05 USD

## PATRONES TECNICOS DESCUBIERTOS

1. **Cencosud (Jumbo/Santa Isabel)** usa BFF propio con API keys publicas embebidas en el frontend
2. **Lider/Walmart** separo marketplace (lider.cl) de supermercado (super.lider.cl) — diferentes dominios y APIs
3. **Todos los supermercados** usan CloudFront o similar para bloquear headless browsers
4. **Los actores de Apify** resuelven el anti-bot usando proxies residenciales y estrategias propias
5. **El pattern exitoso**: NO scrapear directo, usar actores pre-construidos que ya resolvieron el anti-bot
