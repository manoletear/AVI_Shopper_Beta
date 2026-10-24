-- public solamente. No toca ig, ads ni sii_pj.
-- Onboarding del hogar: dirección, tiendas, ajustes, dietTags y substitutionMode.
-- No borra filas. RLS igual que el resto: la familia se resuelve con avi_family_ids().
-- Correr después de 20261024140100_consumption_model_rls.sql.
-- No usar prisma db push contra soc-chile: este archivo es la migración.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "householdOnboarding" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS "dietTags" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.member_preferences
  ADD COLUMN IF NOT EXISTS "substitutionMode" TEXT NOT NULL DEFAULT 'best_match';

ALTER TABLE public.member_preferences
  DROP CONSTRAINT IF EXISTS member_preferences_substitution_mode_check;
ALTER TABLE public.member_preferences
  ADD CONSTRAINT member_preferences_substitution_mode_check
  CHECK ("substitutionMode" IN ('best_match', 'specific', 'none'));

CREATE TABLE IF NOT EXISTS public.family_addresses (
  id TEXT PRIMARY KEY,
  "familyId" TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL DEFAULT '',
  unit TEXT,
  comuna TEXT NOT NULL,
  dropoff TEXT NOT NULL DEFAULT 'door',
  notes TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT family_addresses_dropoff_check
    CHECK (dropoff IN ('door', 'handoff', 'curbside'))
);

CREATE TABLE IF NOT EXISTS public.family_stores (
  id TEXT PRIMARY KEY,
  "familyId" TEXT NOT NULL,
  chain TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  mode TEXT NOT NULL DEFAULT 'delivery',
  "loyaltyProgram" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT family_stores_chain_check
    CHECK (chain IN ('jumbo', 'lider', 'unimarc', 'tottus')),
  CONSTRAINT family_stores_mode_check
    CHECK (mode IN ('delivery', 'pickup')),
  CONSTRAINT family_stores_loyalty_check
    CHECK (
      "loyaltyProgram" IS NULL OR "loyaltyProgram" IN (
        'puntos_cencosud', 'jumbo_prime', 'mi_club_lider', 'club_unimarc', 'cmr_puntos'
      )
    )
);

CREATE TABLE IF NOT EXISTS public.family_settings (
  id TEXT PRIMARY KEY,
  "familyId" TEXT NOT NULL,
  cadence TEXT,
  "deliveryDay" TEXT,
  budget INTEGER,
  "monthlyBudget" INTEGER,
  "orderCap" INTEGER,
  "deliveryWindows" TEXT,
  "approverRole" TEXT NOT NULL DEFAULT 'master',
  "elderWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "proposeAlcohol" BOOLEAN NOT NULL DEFAULT true,
  "householdSize" INTEGER,
  "includesBaby" BOOLEAN NOT NULL DEFAULT false,
  "includesToddler" BOOLEAN NOT NULL DEFAULT false,
  "includesPet" BOOLEAN NOT NULL DEFAULT false,
  "substitutionMode" TEXT NOT NULL DEFAULT 'best_match',
  "specificReplacements" TEXT,
  "onboardingStep" TEXT NOT NULL DEFAULT 'address',
  "stepState" TEXT NOT NULL DEFAULT '{}',
  "mandatoryComplete" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT family_settings_substitution_mode_check
    CHECK ("substitutionMode" IN ('best_match', 'specific', 'none')),
  CONSTRAINT family_settings_approver_check
    CHECK ("approverRole" IN ('master', 'adult')),
  CONSTRAINT family_settings_cadence_check
    CHECK (cadence IS NULL OR cadence IN ('2w', '1m', '2m', '3m', '4m', '5m', '6m'))
);

CREATE INDEX IF NOT EXISTS family_addresses_familyId_idx
  ON public.family_addresses ("familyId");
CREATE UNIQUE INDEX IF NOT EXISTS family_stores_familyId_chain_key
  ON public.family_stores ("familyId", chain);
CREATE INDEX IF NOT EXISTS family_stores_familyId_idx
  ON public.family_stores ("familyId");
CREATE UNIQUE INDEX IF NOT EXISTS family_settings_familyId_key
  ON public.family_settings ("familyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_addresses_familyId_fkey' AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.family_addresses
      ADD CONSTRAINT "family_addresses_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES public.families (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_stores_familyId_fkey' AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.family_stores
      ADD CONSTRAINT "family_stores_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES public.families (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'family_settings_familyId_fkey' AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.family_settings
      ADD CONSTRAINT "family_settings_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES public.families (id) ON DELETE CASCADE;
  END IF;
END $$;

-- Datos de la familia. Misma política que consumption_profiles.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'family_addresses',
    'family_stores',
    'family_settings'
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
