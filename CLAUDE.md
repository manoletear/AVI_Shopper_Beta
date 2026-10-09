# AVI Shopper

Asistente inteligente de compras familiares para Chile.
Compara precios en 4 supermercados (Jumbo, Lider, Unimarc, Tottus),
analiza nutricion, predice reposicion, controla presupuesto.
Con extension de Chrome, agrega productos al carrito automaticamente.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM + PostgreSQL (Supabase soc-chile, schema public)
- NextAuth (credentials, JWT)
- Apify (scraping de precios reales en 4 supermercados)
- Claude API — Haiku (cart chat) + Sonnet (agent con 17 tools + vision)
- Open Food Facts (NutriScore, NOVA, datos nutricionales)
- WhatsApp Cloud API (Meta)
- Flow.cl (pasarela de pagos)
- Chrome Extension (auto-agregar al carrito de supermercados)

## Paleta de marca

- Primary: #4F46E5 (Indigo) — inteligencia, premium
- Accent: #0D9488 (Teal) — ahorro, frescura
- CTA: #F59E0B (Amber) — urgencia, promociones
- Background: #F8FAFC — fondo app
- Text: #0F172A — titulos

## Comandos

```bash
npm run dev              # servidor local
npm run build            # build de produccion
npm run test             # tests Playwright
npx prisma generate      # generar cliente Prisma
npx prisma db push       # aplicar schema a DB
npx tsx prisma/seed-manu.ts  # seed con datos de Manuel
```

## Estructura

- `src/app/` — 20+ paginas + 35+ API routes
- `src/services/` — 19 servicios de negocio
- `src/components/` — BottomNav, SmartAlerts, OnboardingWizard, AdBanner
- `src/lib/` — auth, prisma, validaciones, family resolver, encryption
- `prisma/` — schema (19 modelos) y seeds
- `public/` — avi-icon.svg, banners de supermercados
- `chrome-extension/` — extension para compra automatica
- `tests/` — tests E2E con Playwright

## Convenciones

- Todo texto UI en español chileno
- Precios en CLP (enteros, no centavos)
- Paleta indigo (no blue-600)
- API responses via successResponse/errorResponse
- Auth: requireAuth() retorna userId
- Multi-familia: usar familyWhere(userId) en queries compartidas

## Servicios

| Servicio | Que hace |
|----------|---------|
| agent | Agente conversacional con 17 tool_use |
| proactive-events | Feriados chilenos, cumpleanos, recordatorios |
| encryption | AES-256-GCM para credenciales |
| apify-price | Precios reales + demo fallback + busqueda semantica |
| super-lider | Scraper de super.lider.cl |
| openfoodfacts | NutriScore, NOVA, nutrientes |
| replenishment | Prediccion de reposicion |
| price-observation | Historico de precios |
| purchase-learning | Aprende marcas, tiendas, patrones |
| checkout | Deep links + carrito automatico |
| store-cart | Apify actors para carrito en supermercados |
| whatsapp | WhatsApp Cloud API |
| flow-payment | Pasarela de pagos Flow.cl |
| monthly-nutrition | Analisis nutricional mensual |

## Deploy

- Produccion: Vercel (avi-shopper-beta.vercel.app)
- DB: Supabase soc-chile (sa-east-1, schema public)
- CI: GitHub Actions (typecheck + build + tests)
- WhatsApp: +56 9 9489 3097

## Credenciales

- Demo: demo@avishopper.cl / demo123456
- Manuel: manuel.aravenal@gmail.com (seed en prisma/seed-manu.ts)
