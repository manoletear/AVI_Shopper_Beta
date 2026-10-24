-- public solamente. No toca ig, ads ni sii_pj.
-- No borra tablas ni filas. Agrega columnas a purchase_history.
-- quantity pasa de entero a double precision: 1,5 kg cabe y los enteros se conservan.
-- Las columnas van entre comillas, en camelCase, como Prisma.

ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "familyId" TEXT;
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "memberId" TEXT;
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "canonicalProductId" TEXT;
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "groupKey" TEXT;
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "orderRef" TEXT;
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "baseAmount" DOUBLE PRECISION;
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "baseUnit" TEXT;
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_history'
      AND column_name = 'quantity'
      AND udt_name IN ('int2', 'int4', 'int8')
  ) THEN
    ALTER TABLE public.purchase_history ALTER COLUMN quantity DROP DEFAULT;
    ALTER TABLE public.purchase_history
      ALTER COLUMN quantity TYPE DOUBLE PRECISION
      USING quantity::double precision;
    ALTER TABLE public.purchase_history ALTER COLUMN quantity SET DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_history_familyId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.purchase_history
      ADD CONSTRAINT "purchase_history_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES public.families (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_history_memberId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.purchase_history
      ADD CONSTRAINT "purchase_history_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES public.family_members (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_history_canonicalProductId_fkey'
      AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.purchase_history
      ADD CONSTRAINT "purchase_history_canonicalProductId_fkey"
      FOREIGN KEY ("canonicalProductId") REFERENCES public.canonical_products (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "purchase_history_familyId_groupKey_purchasedAt_idx"
  ON public.purchase_history ("familyId", "groupKey", "purchasedAt");
