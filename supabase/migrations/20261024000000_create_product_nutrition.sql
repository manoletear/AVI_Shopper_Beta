-- Ensure pg_trgm extension for fuzzy name search (must precede trigram index)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Migration: create product_nutrition
-- Description: Catálogo local de información nutricional y alérgenos por producto.
-- Crítico para validación de alergias. Solo schema public.
-- Date: 2026-10-24

-- Enum types
DO $$ BEGIN
  CREATE TYPE allergen_source AS ENUM ('store_page', 'open_food_facts', 'manufacturer', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE allergen_status AS ENUM ('verified', 'partial', 'unverified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.product_nutrition (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  ean           text,                                       -- código de barras, único cuando existe
  store         text CHECK (store IN ('jumbo','lider','unimarc','tottus')),
  store_sku     text,
  brand         text,
  name          text NOT NULL,
  format        text,                                       -- ej. "250 g", "1 L"

  -- Ingredients & allergens
  ingredients_text  text,
  allergens         text[] NOT NULL DEFAULT '{}',            -- normalizados
  traces            text[] NOT NULL DEFAULT '{}',            -- "puede contener"

  -- Nutritional info per 100g
  kcal_100g         real,
  protein_100g      real,
  fat_100g          real,
  carbs_100g        real,
  sugar_100g        real,
  sodium_100mg      real,
  serving_size_g    real,

  -- Chilean labeling
  sellos_chile      text[] NOT NULL DEFAULT '{}',            -- ALTO EN azúcares/grasas/sodio/calorías

  -- Provenance
  source            allergen_source NOT NULL DEFAULT 'manual',
  source_url        text,
  fetched_at        timestamptz,
  allergen_status   allergen_status NOT NULL DEFAULT 'unverified',

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one EAN across the catalogue (when present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_nutrition_ean
  ON public.product_nutrition (ean) WHERE ean IS NOT NULL;

-- Fast lookup by store + SKU
CREATE INDEX IF NOT EXISTS idx_product_nutrition_store_sku
  ON public.product_nutrition (store, store_sku) WHERE store IS NOT NULL AND store_sku IS NOT NULL;

-- Full-text search on name
CREATE INDEX IF NOT EXISTS idx_product_nutrition_name_trgm
  ON public.product_nutrition USING gin (name gin_trgm_ops);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.product_nutrition_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_nutrition_updated ON public.product_nutrition;
CREATE TRIGGER trg_product_nutrition_updated
  BEFORE UPDATE ON public.product_nutrition
  FOR EACH ROW EXECUTE FUNCTION public.product_nutrition_set_updated_at();

-- RLS: lectura para authenticated, escritura solo service_role
ALTER TABLE public.product_nutrition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_nutrition_select" ON public.product_nutrition;
CREATE POLICY "product_nutrition_select"
  ON public.product_nutrition FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "product_nutrition_service_all" ON public.product_nutrition;
CREATE POLICY "product_nutrition_service_all"
  ON public.product_nutrition FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


COMMENT ON TABLE public.product_nutrition IS 'Catálogo local de nutrición y alérgenos. Fuente de verdad para validación de alergias en AVI Shopper.';
COMMENT ON COLUMN public.product_nutrition.allergens IS 'Alérgenos normalizados: peanut, tree_nut, fish, shellfish, gluten, milk, egg, soy, sesame';
COMMENT ON COLUMN public.product_nutrition.traces IS 'Trazas: "puede contener". Mismos valores normalizados.';
COMMENT ON COLUMN public.product_nutrition.allergen_status IS 'verified=lista completa confirmada, partial=fuentes discrepan (unión), unverified=sin ingredientes';
