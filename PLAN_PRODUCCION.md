# AVI Shopper — Plan de Produccion

## Estado Actual: NO COMPILA

El build falla. Sin .env. Sin tests. Sin CI/CD. Sin navegacion entre paginas.
Este plan lleva AVI de "demo rota" a "producto desplegado".

---

## Fase 0 — Desbloquear el Build (CRITICO)

> Sin build, nada mas importa. Esto se hace primero.

| # | Tarea | Agente | Estado |
|---|-------|--------|--------|
| 0.1 | Mover `authOptions` de `route.ts` a `src/lib/auth-options.ts` (Next.js no permite exports custom en route files) | Backend | pendiente |
| 0.2 | Crear `.env` desde `.env.example` con valores funcionales para dev | DevOps | pendiente |
| 0.3 | Ejecutar `npx prisma db push` para crear la DB SQLite local | DevOps | pendiente |
| 0.4 | Verificar `npm run build` pasa sin errores | QA | pendiente |

**Criterio de exito**: `npm run build` termina con exit code 0.

---

## Fase 1 — Fundacion Funcional

> Auth, navegacion, datos semilla. Lo minimo para que un usuario pueda recorrer la app.

| # | Tarea | Agente | Depende de |
|---|-------|--------|------------|
| 1.1 | Crear pagina `/login` con formulario de email + password | Frontend | 0.* |
| 1.2 | Crear pagina `/registro` con formulario de registro | Frontend | 0.* |
| 1.3 | Crear `middleware.ts` para proteger rutas autenticadas | Backend | 0.1 |
| 1.4 | Agregar navegacion global: header con links a Demo, Config, Login/Logout | Frontend | 1.1 |
| 1.5 | Crear `prisma/seed.ts` funcional: 4 tiendas + 30 productos + precios + 1 usuario demo | Backend | 0.3 |
| 1.6 | Ejecutar seed y verificar datos en DB | QA | 1.5 |

**Criterio de exito**: Un usuario puede registrarse, hacer login, ver la landing, y navegar a la demo y configuracion.

---

## Fase 2 — Conectar Todo

> Las paginas dejan de ser hardcoded y usan las APIs reales.

| # | Tarea | Agente | Depende de |
|---|-------|--------|------------|
| 2.1 | Refactorizar `/demo` para consumir `GET /api/products` y `POST /api/stores/compare` en vez de datos locales | Frontend | 1.* |
| 2.2 | Conectar `/configuracion/cuentas` a `GET/POST /api/users/store-accounts` | Frontend | 1.* |
| 2.3 | Crear pagina `/salud` que consuma `GET /api/health?mode=report` y muestre: score, alertas, alternativas, predicciones | Frontend + UX | 1.* |
| 2.4 | Crear pagina `/listas` para CRUD de listas de compras via `/api/shopping-lists` | Frontend | 1.* |
| 2.5 | Agregar pagina `/presupuesto` que consuma `/api/budgets` | Frontend | 1.* |

**Criterio de exito**: Cada pagina muestra datos reales de la DB. No hay datos hardcoded fuera de seed.

---

## Fase 3 — UX/UI Pulido

> Flujos de usuario coherentes. La app se siente como producto, no como demo.

| # | Tarea | Agente | Depende de |
|---|-------|--------|------------|
| 3.1 | Diseñar flujo de onboarding: registro → vincular primer supermercado → crear primera lista | UX Designer | 2.* |
| 3.2 | Dashboard post-login: resumen de listas activas, ahorro del mes, alertas de salud, proxima compra predicha | UX + Frontend | 2.* |
| 3.3 | Pulir responsive mobile en todas las paginas | Frontend | 2.* |
| 3.4 | Agregar feedback visual: loading states, toasts de confirmacion, empty states | Frontend | 2.* |
| 3.5 | Revisar y mejorar copy en español chileno en toda la app | UX Designer | 2.* |

**Criterio de exito**: Un usuario nuevo puede completar el flujo completo sin confundirse.

---

## Fase 4 — Calidad y Tests

> Nada va a produccion sin tests ni CI.

| # | Tarea | Agente | Depende de |
|---|-------|--------|------------|
| 4.1 | Crear `playwright.config.ts` | QA | 0.4 |
| 4.2 | Tests E2E: registro → login → crear lista → agregar producto | QA | 2.* |
| 4.3 | Tests E2E: comparar precios → ver split → ver ahorro | QA | 2.1 |
| 4.4 | Tests API: health report, store accounts, shopping lists | QA | 2.* |
| 4.5 | Crear `.github/workflows/ci.yml`: typecheck + build + tests en cada PR | DevOps | 4.1 |
| 4.6 | Auditoria de seguridad: OWASP top 10, validacion de inputs, auth bypass | QA | 2.* |

**Criterio de exito**: CI verde. Tests pasan. No hay vulnerabilidades criticas.

---

## Fase 5 — Deploy a Produccion

> De localhost al mundo.

| # | Tarea | Agente | Depende de |
|---|-------|--------|------------|
| 5.1 | Cambiar Prisma provider de `sqlite` a `postgresql` con variable de entorno | Backend + DevOps | 4.* |
| 5.2 | Crear proyecto en Vercel, conectar repo GitHub | DevOps | 4.5 |
| 5.3 | Crear DB PostgreSQL (Supabase free tier o Neon) | DevOps | 5.1 |
| 5.4 | Configurar variables de entorno en Vercel: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL | DevOps | 5.2, 5.3 |
| 5.5 | Ejecutar migracion + seed en PostgreSQL de produccion | DevOps | 5.3 |
| 5.6 | Deploy. Verificar que todo funciona en produccion | QA + DevOps | 5.* |
| 5.7 | Configurar cron para `sync:prices` (GitHub Actions scheduled o Vercel Cron) | DevOps | 5.6 |

**Criterio de exito**: App accesible en URL publica. Datos reales. Auth funcional.

---

## Fase 6 — Crecimiento (Post-Launch)

> Despues de estar en produccion.

| # | Tarea | Agente |
|---|-------|--------|
| 6.1 | Integrar Claude API para chat real con el orchestrator de la app | Backend + Architect |
| 6.2 | Scraping real de precios (activar scrapers de Jumbo/Lider) | Backend |
| 6.3 | Notificaciones push (alertas de precio, presupuesto, prediccion) | Backend + Frontend |
| 6.4 | PWA: manifest.json + service worker para instalar en celular | Frontend + DevOps |
| 6.5 | Analytics: tracking de uso real para iterar | Backend |

---

## Resumen de Prioridad

```
AHORA        Fase 0  →  Build funcional        (1-2 horas)
LUEGO        Fase 1  →  Auth + navegacion       (3-4 horas)
DESPUES      Fase 2  →  Conectar APIs           (4-6 horas)
SIGUIENTE    Fase 3  →  UX pulido               (3-4 horas)
ANTES DEPLOY Fase 4  →  Tests + CI              (3-4 horas)
DEPLOY       Fase 5  →  Vercel + PostgreSQL     (2-3 horas)
POST-LAUNCH  Fase 6  →  Chat IA + scraping real (ongoing)
```

**Total estimado a produccion (Fases 0-5): ~20 horas de trabajo agentico**

---

## Asignacion por Agente

| Agente | Fases principales | Carga |
|--------|------------------|-------|
| **Orchestrator** | Coordina todo | Todas |
| **Architect** | 0, 5, 6 | Media |
| **Backend** | 0, 1, 2, 5 | Alta |
| **Frontend** | 1, 2, 3 | Alta |
| **UX Designer** | 2, 3 | Media |
| **QA** | 0, 1, 4 | Media-Alta |
| **DevOps** | 0, 4, 5 | Media |
