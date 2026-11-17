-- ================================================================
-- Lista familiar de compras: flujo nana → aprobadores → carro.
-- ================================================================

-- 1. Lista familiar (una 'open' por hogar a la vez)
CREATE TABLE IF NOT EXISTS public.family_shopping_lists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "familyId" TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','consolidating','confirmed','converted','cancelled')),
  title TEXT,
  "storeHint" TEXT,
  "targetDate" DATE,
  "createdByMemberId" TEXT REFERENCES public.family_members(id) ON DELETE SET NULL,
  "cartId" TEXT REFERENCES public.proposed_carts(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fsl_one_open
  ON public.family_shopping_lists("familyId") WHERE status = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS idx_fsl_cart_unique
  ON public.family_shopping_lists("cartId") WHERE "cartId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fsl_family_status
  ON public.family_shopping_lists("familyId", status);

ALTER TABLE public.family_shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fsl_family" ON public.family_shopping_lists
  FOR ALL USING ("familyId" IN (
    SELECT fm."familyId" FROM public.family_members fm WHERE fm."userId" = auth.uid()
  ));

-- 2. Ítems de la lista
CREATE TABLE IF NOT EXISTS public.family_shopping_list_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "listId" TEXT NOT NULL REFERENCES public.family_shopping_lists(id) ON DELETE CASCADE,
  "rawText" TEXT NOT NULL,
  "normalizedName" TEXT,
  brand TEXT,
  size TEXT,
  quantity FLOAT NOT NULL DEFAULT 1,
  "unitPriceClp" INT,
  "priceSource" TEXT CHECK ("priceSource" IN ('history','live','estimate')),
  "requestedByMemberId" TEXT REFERENCES public.family_members(id) ON DELETE SET NULL,
  "requestedByLabel" TEXT,
  source TEXT NOT NULL DEFAULT 'member'
    CHECK (source IN ('member','pantry_suggestion','avi_suggestion')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected')),
  "allergenWarnings" JSONB DEFAULT '[]',
  note TEXT,
  "groupKey" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fsli_list ON public.family_shopping_list_items("listId");

ALTER TABLE public.family_shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fsli_family" ON public.family_shopping_list_items
  FOR ALL USING ("listId" IN (
    SELECT l.id FROM public.family_shopping_lists l
    INNER JOIN public.family_members fm ON fm."familyId" = l."familyId"
    WHERE fm."userId" = auth.uid()
  ));

-- 3. Confirmaciones de aprobadores
CREATE TABLE IF NOT EXISTS public.family_shopping_list_confirmations (
  "listId" TEXT NOT NULL REFERENCES public.family_shopping_lists(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("listId", "memberId")
);

ALTER TABLE public.family_shopping_list_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fslc_family" ON public.family_shopping_list_confirmations
  FOR ALL USING ("listId" IN (
    SELECT l.id FROM public.family_shopping_lists l
    INNER JOIN public.family_members fm ON fm."familyId" = l."familyId"
    WHERE fm."userId" = auth.uid()
  ));

-- 4. Hilo de mensajes de la lista
CREATE TABLE IF NOT EXISTS public.family_shopping_list_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "listId" TEXT NOT NULL REFERENCES public.family_shopping_lists(id) ON DELETE CASCADE,
  "authorMemberId" TEXT REFERENCES public.family_members(id) ON DELETE SET NULL,
  "authorLabel" TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('request','question','answer','avi_suggestion')),
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fslm_list_date
  ON public.family_shopping_list_messages("listId", "createdAt");

ALTER TABLE public.family_shopping_list_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fslm_family" ON public.family_shopping_list_messages
  FOR ALL USING ("listId" IN (
    SELECT l.id FROM public.family_shopping_lists l
    INNER JOIN public.family_members fm ON fm."familyId" = l."familyId"
    WHERE fm."userId" = auth.uid()
  ));
