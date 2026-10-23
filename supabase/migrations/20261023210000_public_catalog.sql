-- soc-chile (public solamente).
-- No toca los schemas ig, ads ni sii_pj.
-- No borra tablas ni filas. Las 20 tablas que ya existen se dejan como están.
-- Agrega el catálogo de los PR #3/#4 y una columna opcional para enlazar Supabase Auth.
--
-- Los nombres de columna van entre comillas y en camelCase, igual que Prisma.
-- Si al aplicar esto una columna no existe con ese nombre, detente: no reescribas la tabla.

CREATE TABLE IF NOT EXISTS public.canonical_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL,
  variant TEXT,
  "sizeAmount" DOUBLE PRECISION,
  "sizeUnit" TEXT,
  "packCount" INTEGER NOT NULL DEFAULT 1,
  "soldByWeight" BOOLEAN NOT NULL DEFAULT false,
  "minPurchase" DOUBLE PRECISION,
  "stepAmount" DOUBLE PRECISION,
  ean TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_products_ean_key
  ON public.canonical_products (ean);

CREATE INDEX IF NOT EXISTS canonical_products_category_variant_idx
  ON public.canonical_products (category, variant);

CREATE INDEX IF NOT EXISTS canonical_products_brand_idx
  ON public.canonical_products (brand);

CREATE TABLE IF NOT EXISTS public.store_listings (
  id TEXT PRIMARY KEY,
  "storeSlug" TEXT NOT NULL,
  "storeName" TEXT NOT NULL,
  "rawName" TEXT NOT NULL,
  ean TEXT,
  price INTEGER,
  "inStock" BOOLEAN NOT NULL DEFAULT true,
  url TEXT,
  brand TEXT,
  category TEXT,
  variant TEXT,
  "sizeAmount" DOUBLE PRECISION,
  "sizeUnit" TEXT,
  "packCount" INTEGER,
  "soldByWeight" BOOLEAN NOT NULL DEFAULT false,
  "canonicalId" TEXT,
  "matchMethod" TEXT,
  "matchConfidence" DOUBLE PRECISION,
  "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_listings_canonicalId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.store_listings
      ADD CONSTRAINT "store_listings_canonicalId_fkey"
      FOREIGN KEY ("canonicalId") REFERENCES public.canonical_products (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS store_listings_storeSlug_rawName_idx
  ON public.store_listings ("storeSlug", "rawName");

CREATE INDEX IF NOT EXISTS store_listings_ean_idx
  ON public.store_listings (ean);

CREATE INDEX IF NOT EXISTS store_listings_matchStatus_idx
  ON public.store_listings ("matchStatus");

CREATE INDEX IF NOT EXISTS store_listings_canonicalId_idx
  ON public.store_listings ("canonicalId");

CREATE TABLE IF NOT EXISTS public.catalog_reviews (
  id TEXT PRIMARY KEY,
  "listingId" TEXT NOT NULL,
  "suggestedId" TEXT,
  confidence DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "resolverNote" TEXT,
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catalog_reviews_listingId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.catalog_reviews
      ADD CONSTRAINT "catalog_reviews_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES public.store_listings (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catalog_reviews_suggestedId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.catalog_reviews
      ADD CONSTRAINT "catalog_reviews_suggestedId_fkey"
      FOREIGN KEY ("suggestedId") REFERENCES public.canonical_products (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS catalog_reviews_status_idx
  ON public.catalog_reviews (status);

CREATE TABLE IF NOT EXISTS public.product_substitutes (
  id TEXT PRIMARY KEY,
  "fromId" TEXT NOT NULL,
  "toId" TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_substitutes_fromId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.product_substitutes
      ADD CONSTRAINT "product_substitutes_fromId_fkey"
      FOREIGN KEY ("fromId") REFERENCES public.canonical_products (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_substitutes_toId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.product_substitutes
      ADD CONSTRAINT "product_substitutes_toId_fkey"
      FOREIGN KEY ("toId") REFERENCES public.canonical_products (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS product_substitutes_fromId_toId_key
  ON public.product_substitutes ("fromId", "toId");

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "authUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_authUserId_key
  ON public.users ("authUserId");
