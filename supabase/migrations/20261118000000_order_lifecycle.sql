-- ================================================================
-- Order lifecycle: cart states, order recording, substitutions,
-- dual pricing (estimated vs confirmed), idempotent imports.
-- ================================================================

-- 1. Cart status expansion + order link
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "orderRef" TEXT;
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "cancelledByMemberId" TEXT REFERENCES public.family_members(id);
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "orderedAt" TIMESTAMPTZ;
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMPTZ;
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "deliveryFee" INT DEFAULT 0;
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS discount INT DEFAULT 0;
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS "paymentLast4" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposed_carts_orderref
  ON public.proposed_carts("orderRef") WHERE "orderRef" IS NOT NULL;

-- 2. Dual pricing + substitution tracking on cart items
ALTER TABLE public.proposed_cart_items ADD COLUMN IF NOT EXISTS "estimatedPrice" INT;
ALTER TABLE public.proposed_cart_items ADD COLUMN IF NOT EXISTS "confirmedPrice" INT;
ALTER TABLE public.proposed_cart_items ADD COLUMN IF NOT EXISTS "storeProductId" TEXT;
ALTER TABLE public.proposed_cart_items ADD COLUMN IF NOT EXISTS "deliveredQty" FLOAT;
ALTER TABLE public.proposed_cart_items ADD COLUMN IF NOT EXISTS "substitutedFor" TEXT;
ALTER TABLE public.proposed_cart_items ADD COLUMN IF NOT EXISTS "substitutionAccepted" BOOLEAN;

-- 3. Order lines: what was actually delivered and charged
CREATE TABLE IF NOT EXISTS public.order_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "cartId" TEXT NOT NULL REFERENCES public.proposed_carts(id) ON DELETE CASCADE,
  "familyId" TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  "orderRef" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  quantity FLOAT NOT NULL DEFAULT 1,
  "unitPrice" INT NOT NULL,
  subtotal INT NOT NULL,
  "storeProductId" TEXT,
  "isSubstitution" BOOLEAN DEFAULT false,
  "originalItemId" TEXT REFERENCES public.proposed_cart_items(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_lines_cart ON public.order_lines("cartId");
CREATE INDEX IF NOT EXISTS idx_order_lines_orderref ON public.order_lines("orderRef");

ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_lines_family" ON public.order_lines
  FOR ALL USING ("familyId" IN (
    SELECT fm."familyId" FROM public.family_members fm WHERE fm."userId" = auth.uid()
  ));

-- 4. Substitution preferences: remember accepted/rejected swaps
CREATE TABLE IF NOT EXISTS public.substitution_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "familyId" TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  "originalGroupKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "substituteName" TEXT NOT NULL,
  "substituteGroupKey" TEXT,
  accepted BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subst_prefs_family
  ON public.substitution_preferences("familyId", "originalGroupKey");

ALTER TABLE public.substitution_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subst_prefs_family" ON public.substitution_preferences
  FOR ALL USING ("familyId" IN (
    SELECT fm."familyId" FROM public.family_members fm WHERE fm."userId" = auth.uid()
  ));

-- 5. Idempotency for import_purchases: same orderRef + productName = skip
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_history_orderref_product
  ON public.purchase_history("orderRef", "productName")
  WHERE "orderRef" IS NOT NULL;
