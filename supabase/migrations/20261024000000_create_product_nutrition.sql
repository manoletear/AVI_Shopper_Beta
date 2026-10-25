-- public.product_nutrition ya existía en soc-chile. La versión anterior de
-- este archivo hacía CREATE TABLE IF NOT EXISTS (no-op) y además creaba los
-- índices duplicados idx_product_nutrition_ean e idx_product_nutrition_store_sku.
-- Este SQL describe la tabla viva: columnas, CHECKs e índices reales.
-- Es idempotente. Si la tabla ya existe, no la altera.
-- source y allergen_status son text con CHECK, no enums.
-- No crea esos índices duplicados. El follow-up
-- 20261025011500_drop_product_nutrition_duplicate_indexes.sql los elimina
-- en bases donde la versión anterior ya corrió. No aplicar ese follow-up
-- desde el cambio de código.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.product_nutrition (
  id                    text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  canonical_product_id  text,
  ean                   text,
  store                 text,
  store_sku             text,
  brand                 text,
  name                  text NOT NULL,
  format                text,
  ingredients_text      text,
  allergens             text[] NOT NULL DEFAULT '{}',
  traces                text[] NOT NULL DEFAULT '{}',
  kcal_100g             double precision,
  protein_100g          double precision,
  fat_100g              double precision,
  carbs_100g            double precision,
  sugar_100g            double precision,
  sodium_mg_100g        double precision,
  serving_size_g        double precision,
  sellos_chile          text[] NOT NULL DEFAULT '{}',
  source                text NOT NULL,
  source_url            text,
  source_detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  allergen_status       text NOT NULL DEFAULT 'unverified',
  fetched_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_nutrition_store_check CHECK (
    store = ANY (ARRAY['jumbo', 'lider', 'unimarc', 'tottus']::text[])
  ),
  CONSTRAINT product_nutrition_source_check CHECK (
    source = ANY (ARRAY['store_page', 'open_food_facts', 'manufacturer', 'manual']::text[])
  ),
  CONSTRAINT product_nutrition_allergen_status_check CHECK (
    allergen_status = ANY (ARRAY['verified', 'partial', 'unverified']::text[])
  ),
  CONSTRAINT pn_allergens_vocab CHECK (
    allergens <@ ARRAY[
      'peanut', 'tree_nut', 'fish', 'crustacean', 'mollusc', 'gluten', 'milk', 'egg',
      'soy', 'sesame', 'sulfites', 'mustard', 'celery', 'lupin'
    ]::text[]
  ),
  CONSTRAINT pn_traces_vocab CHECK (
    traces <@ ARRAY[
      'peanut', 'tree_nut', 'fish', 'crustacean', 'mollusc', 'gluten', 'milk', 'egg',
      'soy', 'sesame', 'sulfites', 'mustard', 'celery', 'lupin'
    ]::text[]
  ),
  CONSTRAINT pn_sellos_vocab CHECK (
    sellos_chile <@ ARRAY[
      'alto_azucares', 'alto_grasas_saturadas', 'alto_sodio', 'alto_calorias'
    ]::text[]
  ),
  CONSTRAINT pn_has_identity CHECK (
    ean IS NOT NULL OR store_sku IS NOT NULL OR canonical_product_id IS NOT NULL
  ),
  CONSTRAINT pn_sku_needs_store CHECK (
    store_sku IS NULL OR store IS NOT NULL
  ),
  CONSTRAINT pn_verified_rule CHECK (
    allergen_status <> 'verified'
    OR (
      ingredients_text IS NOT NULL
      AND source = ANY (ARRAY['store_page', 'manufacturer', 'manual']::text[])
    )
  ),
  CONSTRAINT product_nutrition_canonical_product_id_fkey
    FOREIGN KEY (canonical_product_id) REFERENCES public.canonical_products (id)
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_nutrition_ean_uniq
  ON public.product_nutrition (ean) WHERE ean IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_nutrition_store_sku_uniq
  ON public.product_nutrition (store, store_sku) WHERE store_sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_nutrition_canonical_idx
  ON public.product_nutrition (canonical_product_id);

CREATE INDEX IF NOT EXISTS product_nutrition_fetched_idx
  ON public.product_nutrition (fetched_at);

CREATE INDEX IF NOT EXISTS idx_product_nutrition_name_trgm
  ON public.product_nutrition USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.product_nutrition_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_nutrition_updated'
  ) THEN
    CREATE TRIGGER trg_product_nutrition_updated
      BEFORE UPDATE ON public.product_nutrition
      FOR EACH ROW EXECUTE FUNCTION public.product_nutrition_set_updated_at();
  END IF;
END $$;

ALTER TABLE public.product_nutrition ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_nutrition'
      AND policyname = 'product_nutrition_select'
  ) THEN
    CREATE POLICY "product_nutrition_select"
      ON public.product_nutrition FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_nutrition'
      AND policyname = 'product_nutrition_service_all'
  ) THEN
    CREATE POLICY "product_nutrition_service_all"
      ON public.product_nutrition FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.product_nutrition IS
  'Catálogo local de nutrición y alérgenos. Fuente de verdad para validación de alergias en AVI Shopper.';
COMMENT ON COLUMN public.product_nutrition.allergens IS
  'peanut, tree_nut, fish, crustacean, mollusc, gluten, milk, egg, soy, sesame, sulfites, mustard, celery, lupin';
COMMENT ON COLUMN public.product_nutrition.traces IS
  'Trazas ("puede contener"). Mismo vocabulario que allergens.';
COMMENT ON COLUMN public.product_nutrition.allergen_status IS
  'verified solo con ingredientes y fuente store_page/manufacturer/manual. OFF queda partial o unverified.';
COMMENT ON COLUMN public.product_nutrition.sodium_mg_100g IS
  'Sodio en miligramos por 100 g.';
COMMENT ON COLUMN public.product_nutrition.source_detail IS
  'jsonb NOT NULL. Detalle de la fuente. Default {}.';
