-- RLS solo en public. No modifica ig, ads ni sii_pj.
-- Aplicar como postgres (el SQL editor y supabase db push lo hacen).
-- Ese rol es superuser: salta RLS aunque esté en FORCE, y las funciones
-- quedan de su propiedad para poder leer users y resolver auth.uid().
-- service_role también salta RLS. anon y authenticated no.

-- El id de la app es un cuid de NextAuth, no auth.uid().
-- authUserId es el uuid de Supabase Auth, en texto, cuando alguien lo enlace.
CREATE OR REPLACE FUNCTION public.avi_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u."authUserId" = auth.uid()::text
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.avi_family_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT me."familyId"
  FROM public.family_members me
  JOIN public.users u ON u.id = me."userId"
  WHERE u."authUserId" = auth.uid()::text
    AND me."isActive" = true
$$;

CREATE OR REPLACE FUNCTION public.avi_family_user_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.avi_user_id()
  UNION
  SELECT mate."userId"
  FROM public.family_members me
  JOIN public.users u ON u.id = me."userId"
  JOIN public.family_members mate
    ON mate."familyId" = me."familyId"
   AND mate."isActive" = true
   AND mate."userId" IS NOT NULL
  WHERE u."authUserId" = auth.uid()::text
    AND me."isActive" = true
$$;

REVOKE ALL ON FUNCTION public.avi_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avi_family_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avi_family_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avi_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.avi_family_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.avi_family_user_ids() TO authenticated;

-- Quita políticas viejas solo en las tablas de esta app.
-- Una política USING (true) que hubiera quedado anularía las de abajo.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'users', 'user_consents', 'user_preferences', 'stores', 'products',
        'product_prices', 'shopping_lists', 'shopping_items', 'orders', 'budgets',
        'alerts', 'nutrition_data', 'shortcut_templates', 'store_accounts',
        'price_observations', 'purchase_history', 'families', 'family_members',
        'family_events', 'leads', 'canonical_products', 'store_listings',
        'catalog_reviews', 'product_substitutes'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Catálogo, precios y tiendas: lectura pública, escritura solo service_role.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'stores',
    'products',
    'product_prices',
    'shortcut_templates',
    'price_observations',
    'canonical_products',
    'store_listings',
    'product_substitutes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
    EXECUTE format('DROP POLICY IF EXISTS avi_public_read ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY avi_public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      tbl
    );
  END LOOP;
END $$;

-- Cola de revisión: ni lectura ni escritura para anon/authenticated.
ALTER TABLE public.catalog_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_reviews FROM anon, authenticated;
GRANT ALL ON TABLE public.catalog_reviews TO service_role;
DROP POLICY IF EXISTS avi_public_read ON public.catalog_reviews;

-- Datos del hogar. Sin authUserId enlazado, la API de Supabase no devuelve filas.
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'shopping_lists',
    'orders',
    'budgets',
    'alerts',
    'nutrition_data',
    'purchase_history',
    'user_consents',
    'user_preferences'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
    EXECUTE format('DROP POLICY IF EXISTS avi_family_all ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY avi_family_all ON public.%I FOR ALL TO authenticated USING ("userId" IN (SELECT public.avi_family_user_ids())) WITH CHECK ("userId" IN (SELECT public.avi_family_user_ids()))',
      tbl
    );
  END LOOP;
END $$;

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shopping_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopping_items TO authenticated;
GRANT ALL ON TABLE public.shopping_items TO service_role;
DROP POLICY IF EXISTS avi_family_all ON public.shopping_items;
CREATE POLICY avi_family_all ON public.shopping_items
  FOR ALL TO authenticated
  USING (
    "shoppingListId" IN (
      SELECT l.id FROM public.shopping_lists l
      WHERE l."userId" IN (SELECT public.avi_family_user_ids())
    )
  )
  WITH CHECK (
    "shoppingListId" IN (
      SELECT l.id FROM public.shopping_lists l
      WHERE l."userId" IN (SELECT public.avi_family_user_ids())
    )
  );

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.families FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.families TO authenticated;
GRANT ALL ON TABLE public.families TO service_role;
DROP POLICY IF EXISTS avi_family_all ON public.families;
CREATE POLICY avi_family_all ON public.families
  FOR ALL TO authenticated
  USING (id IN (SELECT public.avi_family_ids()))
  WITH CHECK (id IN (SELECT public.avi_family_ids()));

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.family_members FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.family_members TO authenticated;
GRANT ALL ON TABLE public.family_members TO service_role;
DROP POLICY IF EXISTS avi_family_all ON public.family_members;
CREATE POLICY avi_family_all ON public.family_members
  FOR ALL TO authenticated
  USING ("familyId" IN (SELECT public.avi_family_ids()))
  WITH CHECK ("familyId" IN (SELECT public.avi_family_ids()));

ALTER TABLE public.family_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.family_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.family_events TO authenticated;
GRANT ALL ON TABLE public.family_events TO service_role;
DROP POLICY IF EXISTS avi_family_all ON public.family_events;
CREATE POLICY avi_family_all ON public.family_events
  FOR ALL TO authenticated
  USING ("familyId" IN (SELECT public.avi_family_ids()))
  WITH CHECK ("familyId" IN (SELECT public.avi_family_ids()));

-- Credenciales de supermercado: solo el dueño, no el resto de la familia.
ALTER TABLE public.store_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_accounts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_accounts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_accounts TO authenticated;
GRANT ALL ON TABLE public.store_accounts TO service_role;
DROP POLICY IF EXISTS avi_owner_all ON public.store_accounts;
CREATE POLICY avi_owner_all ON public.store_accounts
  FOR ALL TO authenticated
  USING ("userId" = public.avi_user_id())
  WITH CHECK ("userId" = public.avi_user_id());

-- La clave de la app no sale por la API. La familia ve el perfil, no el hash.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
GRANT SELECT (id, email, name, image, "createdAt", "updatedAt", "authUserId") ON public.users TO authenticated;
GRANT UPDATE (name, image) ON public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;
DROP POLICY IF EXISTS avi_users_select ON public.users;
DROP POLICY IF EXISTS avi_users_update ON public.users;
CREATE POLICY avi_users_select ON public.users
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.avi_family_user_ids()));
CREATE POLICY avi_users_update ON public.users
  FOR UPDATE TO authenticated
  USING (id = public.avi_user_id())
  WITH CHECK (id = public.avi_user_id());

-- Leads del formulario: se pueden dejar, no se pueden leer por la API pública.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.leads FROM anon, authenticated;
GRANT INSERT ON TABLE public.leads TO anon, authenticated;
GRANT ALL ON TABLE public.leads TO service_role;
DROP POLICY IF EXISTS avi_leads_insert ON public.leads;
CREATE POLICY avi_leads_insert ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
