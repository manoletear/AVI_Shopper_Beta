-- public solamente. No toca ig, ads ni sii_pj.
-- Tablas nuevas y dos columnas en family_events. No borra filas.
-- RLS igual que el resto: la familia se resuelve con avi_family_ids().
-- product_groups es catálogo: lo lee anon y authenticated; escribe service_role.
-- Correr después de 20261023210100_public_rls.sql, que crea avi_family_ids().

ALTER TABLE public.family_events ADD COLUMN IF NOT EXISTS multiplier DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE public.family_events ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE public.family_events ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS public.product_groups (
  id TEXT PRIMARY KEY,
  "familyKey" TEXT NOT NULL,
  category TEXT NOT NULL,
  "defaultBaseUnit" TEXT NOT NULL,
  "priorPerPersonDay" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS product_groups_familyKey_key
  ON public.product_groups ("familyKey");

CREATE TABLE IF NOT EXISTS public.consumption_profiles (
  id TEXT PRIMARY KEY,
  "familyId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "ratePerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rateVar" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rateMedian" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rateMad" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgInterval" DOUBLE PRECISION,
  "lastPurchaseAt" TIMESTAMP(3),
  "lastAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  leftover DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stockAnchoredAt" TIMESTAMP(3),
  "runOutAt" TIMESTAMP(3),
  "bandEarly" TIMESTAMP(3),
  "bandLate" TIMESTAMP(3),
  confidence TEXT NOT NULL DEFAULT 'baja',
  "nPurchases" INTEGER NOT NULL DEFAULT 0,
  "nIntervals" INTEGER NOT NULL DEFAULT 0,
  "seasonFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "monthCounts" TEXT,
  frozen BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.proposed_carts (
  id TEXT PRIMARY KEY,
  "familyId" TEXT NOT NULL,
  "storeSlug" TEXT NOT NULL,
  "storeName" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  subtotal INTEGER NOT NULL DEFAULT 0,
  delivery INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  "minOrder" INTEGER NOT NULL DEFAULT 0,
  "meetsMinimum" BOOLEAN NOT NULL DEFAULT false,
  note TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.replenishment_alerts (
  id TEXT PRIMARY KEY,
  "familyId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "predictedRunOut" TIMESTAMP(3),
  "bandEarly" TIMESTAMP(3),
  "bandLate" TIMESTAMP(3),
  status TEXT NOT NULL DEFAULT 'open',
  "cartId" TEXT,
  message TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.alert_feedback (
  id TEXT PRIMARY KEY,
  "alertId" TEXT NOT NULL,
  "memberId" TEXT,
  kind TEXT NOT NULL,
  "stockReported" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.member_preferences (
  id TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "preferredCanonicalId" TEXT,
  avoid BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.proposed_cart_items (
  id TEXT PRIMARY KEY,
  "cartId" TEXT NOT NULL,
  "groupId" TEXT,
  "canonicalProductId" TEXT,
  name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  payable INTEGER NOT NULL,
  "runOutAt" TIMESTAMP(3),
  "pulledForward" BOOLEAN NOT NULL DEFAULT false
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_profiles_familyId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.consumption_profiles
      ADD CONSTRAINT "consumption_profiles_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES public.families (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consumption_profiles_groupId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.consumption_profiles
      ADD CONSTRAINT "consumption_profiles_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES public.product_groups (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposed_carts_familyId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.proposed_carts
      ADD CONSTRAINT "proposed_carts_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES public.families (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_alerts_familyId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.replenishment_alerts
      ADD CONSTRAINT "replenishment_alerts_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES public.families (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_alerts_groupId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.replenishment_alerts
      ADD CONSTRAINT "replenishment_alerts_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES public.product_groups (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'replenishment_alerts_cartId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.replenishment_alerts
      ADD CONSTRAINT "replenishment_alerts_cartId_fkey"
      FOREIGN KEY ("cartId") REFERENCES public.proposed_carts (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_feedback_alertId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.alert_feedback
      ADD CONSTRAINT "alert_feedback_alertId_fkey"
      FOREIGN KEY ("alertId") REFERENCES public.replenishment_alerts (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_feedback_memberId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.alert_feedback
      ADD CONSTRAINT "alert_feedback_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES public.family_members (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_preferences_memberId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.member_preferences
      ADD CONSTRAINT "member_preferences_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES public.family_members (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_preferences_groupId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.member_preferences
      ADD CONSTRAINT "member_preferences_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES public.product_groups (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_preferences_preferredCanonicalId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.member_preferences
      ADD CONSTRAINT "member_preferences_preferredCanonicalId_fkey"
      FOREIGN KEY ("preferredCanonicalId") REFERENCES public.canonical_products (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposed_cart_items_cartId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.proposed_cart_items
      ADD CONSTRAINT "proposed_cart_items_cartId_fkey"
      FOREIGN KEY ("cartId") REFERENCES public.proposed_carts (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposed_cart_items_groupId_fkey' AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.proposed_cart_items
      ADD CONSTRAINT "proposed_cart_items_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES public.product_groups (id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS consumption_profiles_familyId_groupId_key
  ON public.consumption_profiles ("familyId", "groupId");
CREATE INDEX IF NOT EXISTS consumption_profiles_familyId_runOutAt_idx
  ON public.consumption_profiles ("familyId", "runOutAt");
CREATE INDEX IF NOT EXISTS proposed_carts_familyId_status_idx
  ON public.proposed_carts ("familyId", status);
CREATE INDEX IF NOT EXISTS replenishment_alerts_familyId_status_idx
  ON public.replenishment_alerts ("familyId", status);
CREATE INDEX IF NOT EXISTS alert_feedback_alertId_idx
  ON public.alert_feedback ("alertId");
CREATE UNIQUE INDEX IF NOT EXISTS member_preferences_memberId_groupId_key
  ON public.member_preferences ("memberId", "groupId");
CREATE INDEX IF NOT EXISTS proposed_cart_items_cartId_idx
  ON public.proposed_cart_items ("cartId");

-- Catálogo de grupos: lectura pública, escritura solo service_role.
ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_groups FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_groups FROM anon, authenticated;
GRANT SELECT ON TABLE public.product_groups TO anon, authenticated;
GRANT ALL ON TABLE public.product_groups TO service_role;
DROP POLICY IF EXISTS avi_public_read ON public.product_groups;
CREATE POLICY avi_public_read ON public.product_groups
  FOR SELECT TO anon, authenticated USING (true);

-- Datos de la familia.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'consumption_profiles',
    'replenishment_alerts',
    'proposed_carts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
    EXECUTE format('DROP POLICY IF EXISTS avi_family_all ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY avi_family_all ON public.%I FOR ALL TO authenticated USING ("familyId" IN (SELECT public.avi_family_ids())) WITH CHECK ("familyId" IN (SELECT public.avi_family_ids()))',
      tbl
    );
  END LOOP;
END $$;

ALTER TABLE public.alert_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_feedback FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.alert_feedback FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.alert_feedback TO authenticated;
GRANT ALL ON TABLE public.alert_feedback TO service_role;
DROP POLICY IF EXISTS avi_family_all ON public.alert_feedback;
CREATE POLICY avi_family_all ON public.alert_feedback
  FOR ALL TO authenticated
  USING (
    "alertId" IN (
      SELECT a.id FROM public.replenishment_alerts a
      WHERE a."familyId" IN (SELECT public.avi_family_ids())
    )
  )
  WITH CHECK (
    "alertId" IN (
      SELECT a.id FROM public.replenishment_alerts a
      WHERE a."familyId" IN (SELECT public.avi_family_ids())
    )
  );

ALTER TABLE public.member_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_preferences TO authenticated;
GRANT ALL ON TABLE public.member_preferences TO service_role;
DROP POLICY IF EXISTS avi_family_all ON public.member_preferences;
CREATE POLICY avi_family_all ON public.member_preferences
  FOR ALL TO authenticated
  USING (
    "memberId" IN (
      SELECT m.id FROM public.family_members m
      WHERE m."familyId" IN (SELECT public.avi_family_ids())
    )
  )
  WITH CHECK (
    "memberId" IN (
      SELECT m.id FROM public.family_members m
      WHERE m."familyId" IN (SELECT public.avi_family_ids())
    )
  );

ALTER TABLE public.proposed_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposed_cart_items FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.proposed_cart_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.proposed_cart_items TO authenticated;
GRANT ALL ON TABLE public.proposed_cart_items TO service_role;
DROP POLICY IF EXISTS avi_family_all ON public.proposed_cart_items;
CREATE POLICY avi_family_all ON public.proposed_cart_items
  FOR ALL TO authenticated
  USING (
    "cartId" IN (
      SELECT c.id FROM public.proposed_carts c
      WHERE c."familyId" IN (SELECT public.avi_family_ids())
    )
  )
  WITH CHECK (
    "cartId" IN (
      SELECT c.id FROM public.proposed_carts c
      WHERE c."familyId" IN (SELECT public.avi_family_ids())
    )
  );
