# AVI Shopper — Guia de Deploy

## Prerequisitos

- Cuenta en [Vercel](https://vercel.com) (free tier)
- Base de datos PostgreSQL:
  - [Supabase](https://supabase.com) (free tier, recomendado)
  - [Neon](https://neon.tech) (free tier)
  - O cualquier PostgreSQL accesible

## Paso 1: Crear base de datos PostgreSQL

En Supabase o Neon, crea un nuevo proyecto. Copia el connection string:

```
postgresql://postgres:TU_PASSWORD@db.xxx.supabase.co:5432/postgres
```

## Paso 2: Preparar schema para PostgreSQL

```bash
npm run deploy:prepare
```

Esto cambia `provider = "sqlite"` a `provider = "postgresql"` en el schema de Prisma.

## Paso 3: Configurar variables de entorno

En Vercel Dashboard > Settings > Environment Variables:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:PASS@host:5432/postgres?sslmode=require` |
| `NEXTAUTH_SECRET` | Resultado de `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://tu-dominio.vercel.app` |

## Paso 4: Deploy a Vercel

```bash
# Opcion A: Conectar repo en Vercel Dashboard
# Vercel detecta Next.js automaticamente

# Opcion B: CLI
npx vercel --prod
```

## Paso 5: Inicializar base de datos

Despues del primer deploy:

```bash
# Con la DATABASE_URL de produccion
DATABASE_URL="postgresql://..." npx prisma db push
DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts
```

## Paso 6: Verificar

1. Abrir `https://tu-dominio.vercel.app`
2. Registrar un usuario nuevo
3. Login con demo@avishopper.cl / demo123456
4. Verificar: dashboard, listas, salud, configuracion

## Revertir a desarrollo local

```bash
npm run deploy:revert   # Vuelve a SQLite
npx prisma generate
npx prisma db push
```

## Comandos utiles

```bash
npm run build           # Verificar build local
npm run test            # Correr tests
npm run deploy:prepare  # Cambiar a PostgreSQL
npm run deploy:revert   # Volver a SQLite
npm run db:seed         # Poblar base de datos
npm run sync:prices     # Sincronizar precios (requiere Playwright)
```
