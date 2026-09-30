# AVI Shopper

Asistente inteligente de compras familiares para Chile.
Compara precios en 4 supermercados (Jumbo, Lider, Santa Isabel, Unimarc),
analiza nutricion, predice reposicion, y controla presupuesto.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM + PostgreSQL (Supabase, schema public)
- NextAuth (credentials, JWT)
- Apify (scraping de precios reales)
- TypeSafe (decisiones inteligentes)
- Open Food Facts (datos nutricionales)
- Flow.cl (pasarela de pagos)
- Claude API + tool_use (agente conversacional)

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

- `src/app/` — paginas y API routes (Next.js App Router)
- `src/services/` — logica de negocio (12 servicios)
- `src/lib/` — auth, prisma, validaciones, respuestas
- `prisma/` — schema y seed
- `agents/` — equipo agentico (7 agentes + runner)
- `tests/` — tests E2E con Playwright

## Convenciones

- Todo texto UI en español chileno
- Precios en CLP (enteros, no centavos)
- Validacion con Zod (usar error.issues, no error.errors)
- API responses via successResponse/errorResponse
- Auth: requireAuth() retorna userId
- No commitear .env — solo .env.example
- Prisma en postgresql para produccion, sqlite para dev local

## Servicios clave

| Servicio | Que hace |
|----------|---------|
| apify-price | Precios reales via Apify actors |
| super-lider | Scraper de super.lider.cl |
| openfoodfacts | NutriScore, NOVA, nutrientes |
| typesafe-decision | Matching, salud, alergenos, urgencia |
| health-intelligence | Alertas, alternativas, prediccion |
| replenishment | Prediccion de reposicion |
| price-observation | Historico de precios con timestamp |
| agent | Agente conversacional con tool_use |
| flow-payment | Pasarela de pagos Flow.cl |

## Deploy

- Produccion: Vercel (avi-shopper-beta.vercel.app)
- DB: Supabase soc-chile (sa-east-1, schema public)
- CI: GitHub Actions (typecheck + build + tests)

## Credenciales demo

Email: demo@avishopper.cl / Password: demo123456
