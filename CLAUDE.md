# AVI Shopper

Asistente inteligente de compras familiares para Chile.
Compara precios en 5 supermercados (Jumbo, Lider, Santa Isabel, Unimarc, Tottus),
analiza nutricion, predice reposicion, controla presupuesto, y compra por ti.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM + PostgreSQL (Supabase soc-chile, schema public)
- NextAuth (credentials, JWT)
- Apify (scraping de precios reales en 5 supermercados)
- TypeSafe (decisiones inteligentes: matching, salud, alergenos)
- Open Food Facts (NutriScore, NOVA, datos nutricionales)
- Claude API + tool_use (agente conversacional con 12 tools)
- WhatsApp Cloud API (Meta)
- Flow.cl (pasarela de pagos)

## Comandos

```bash
npm run dev              # servidor local
npm run build            # build de produccion
npm run test             # tests Playwright
npx prisma generate      # generar cliente Prisma
npx prisma db push       # aplicar schema a DB
npx tsx prisma/seed.ts   # poblar con datos demo
```

## Estructura

- `src/app/` — 16 paginas + 32 API routes
- `src/services/` — 16 servicios de negocio
- `src/components/` — BottomNav, SmartAlerts
- `src/lib/` — auth, prisma, validaciones, family resolver
- `prisma/` — schema (18 modelos) y seed
- `public/` — avi-icon.svg (Warm Assistant)
- `tests/` — tests E2E con Playwright

## Convenciones

- Todo texto UI en español chileno
- Precios en CLP (enteros, no centavos)
- Validacion con Zod (usar error.issues, no error.errors)
- API responses via successResponse/errorResponse
- Auth: requireAuth() retorna userId
- Multi-familia: usar familyWhere(userId) en queries compartidas
- No commitear .env — solo .env.example
- Prisma en postgresql para produccion, sqlite para dev local
- CI cambia provider a sqlite con sed en el workflow

## Servicios

| Servicio | Que hace |
|----------|---------|
| agent | Agente conversacional con 15 tool_use |
| apify-price | Precios reales via Apify actors |
| super-lider | Scraper de super.lider.cl |
| openfoodfacts | NutriScore, NOVA, nutrientes |
| typesafe-decision | Matching, salud, alergenos, urgencia |
| health-intelligence | Alertas, alternativas, prediccion |
| replenishment | Prediccion de reposicion |
| price-observation | Historico de precios con timestamp |
| purchase-learning | Aprende marcas, tiendas, patrones |
| checkout | Deep links + carrito automatico |
| store-cart | Login y carrito en supermercados |
| whatsapp | WhatsApp Cloud API |
| flow-payment | Pasarela de pagos Flow.cl |
| cart | Comparacion y split cart |
| nutrition | Score nutricional |
| analytics | Metricas de uso |

## Deploy

- Produccion: Vercel (avi-shopper-beta.vercel.app)
- DB: Supabase soc-chile (sa-east-1, schema public, RLS activo)
- CI: GitHub Actions (typecheck + build + tests)
- WhatsApp: webhook en /api/whatsapp

## Credenciales demo

Email: demo@avishopper.cl / Password: demo123456
