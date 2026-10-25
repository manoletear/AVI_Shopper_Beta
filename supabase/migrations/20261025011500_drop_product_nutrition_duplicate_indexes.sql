-- Follow-up de 20261024000000_create_product_nutrition.sql.
-- La primera versión de esa migración creó, sobre la tabla que ya existía:
--   idx_product_nutrition_ean        UNIQUE (ean) WHERE ean IS NOT NULL
--   idx_product_nutrition_store_sku  (store, store_sku) WHERE store IS NOT NULL AND store_sku IS NOT NULL
-- Duplican product_nutrition_ean_uniq y product_nutrition_store_sku_uniq.
-- Este archivo solo los elimina. No toca columnas, CHECKs ni datos.
-- No aplicar en el cambio que alinea el código: queda listo para correr aparte.

DROP INDEX IF EXISTS public.idx_product_nutrition_ean;
DROP INDEX IF EXISTS public.idx_product_nutrition_store_sku;
