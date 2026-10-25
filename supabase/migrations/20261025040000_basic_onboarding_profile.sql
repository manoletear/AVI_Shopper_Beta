-- Onboarding básico. Idempotente. No borra filas.
-- La base viva (soc-chile) ya tiene estas columnas y el check con propose_approve.
-- Este archivo solo documenta el cambio para otros entornos. No correr prisma db push.

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS sex TEXT;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS "ageRange" TEXT;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS size TEXT;

ALTER TABLE public.family_addresses
  ADD COLUMN IF NOT EXISTS "housingType" TEXT;

-- family_settings y member_preferences aceptan propose_approve.
DO $$
BEGIN
  IF to_regclass('public.family_settings') IS NOT NULL AND (
    NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'family_settings_substitution_mode_check'
        AND connamespace = 'public'::regnamespace
    )
    OR EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'family_settings_substitution_mode_check'
        AND connamespace = 'public'::regnamespace
        AND pg_get_constraintdef(oid) NOT LIKE '%propose_approve%'
    )
  ) THEN
    ALTER TABLE public.family_settings
      DROP CONSTRAINT IF EXISTS family_settings_substitution_mode_check;
    ALTER TABLE public.family_settings
      ADD CONSTRAINT family_settings_substitution_mode_check
      CHECK ("substitutionMode" IN ('best_match', 'specific', 'none', 'propose_approve'));
  END IF;

  IF to_regclass('public.member_preferences') IS NOT NULL AND (
    NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'member_preferences_substitution_mode_check'
        AND connamespace = 'public'::regnamespace
    )
    OR EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'member_preferences_substitution_mode_check'
        AND connamespace = 'public'::regnamespace
        AND pg_get_constraintdef(oid) NOT LIKE '%propose_approve%'
    )
  ) THEN
    ALTER TABLE public.member_preferences
      DROP CONSTRAINT IF EXISTS member_preferences_substitution_mode_check;
    ALTER TABLE public.member_preferences
      ADD CONSTRAINT member_preferences_substitution_mode_check
      CHECK ("substitutionMode" IN ('best_match', 'specific', 'none', 'propose_approve'));
  END IF;
END $$;
