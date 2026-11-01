-- Conexión de cuentas de supermercado + resultado de llenar el carro real.
-- Idempotente. Solo schema public. NO aplicar con prisma db push.
-- Nunca guarda contraseñas: encryptedSession = cookies cifradas AES-256-GCM (formato v1.iv.tag.ct).
-- RLS activado SIN políticas para anon/authenticated: solo el backend (rol dueño / service_role) lee.

CREATE TABLE IF NOT EXISTS public.store_connections (
  "id"               text PRIMARY KEY,
  "familyId"         text NOT NULL REFERENCES public.families("id") ON DELETE CASCADE,
  "storeSlug"        text NOT NULL CHECK ("storeSlug" IN ('jumbo','lider','unimarc','tottus')),
  "encryptedSession" text NOT NULL CHECK ("encryptedSession" LIKE 'v1.%'),
  "status"           text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','expired','needs_user_action')),
  "lastVerifiedAt"   timestamp(3),
  "createdAt"        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        timestamp(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_connections_familyId_storeSlug_key"
  ON public.store_connections ("familyId", "storeSlug");

CREATE TABLE IF NOT EXISTS public.store_cart_fills (
  "id"             text PRIMARY KEY,
  "familyId"       text NOT NULL REFERENCES public.families("id") ON DELETE CASCADE,
  "cartId"         text NOT NULL REFERENCES public.proposed_carts("id") ON DELETE CASCADE,
  "storeSlug"      text NOT NULL,
  "status"         text NOT NULL CHECK ("status" IN ('filled','partial','needs_user_action','failed')),
  "itemsRequested" integer NOT NULL DEFAULT 0,
  "itemsAdded"     integer NOT NULL DEFAULT 0,
  "approvedTotal"  integer NOT NULL DEFAULT 0,
  "storeTotal"     integer,
  "substitutes"    text NOT NULL DEFAULT '[]',
  "comparison"     text,
  "message"        text,
  "createdAt"      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "store_cart_fills_cartId_idx" ON public.store_cart_fills ("cartId");
CREATE INDEX IF NOT EXISTS "store_cart_fills_familyId_createdAt_idx" ON public.store_cart_fills ("familyId", "createdAt");

ALTER TABLE public.store_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_cart_fills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_connections FROM anon, authenticated;
REVOKE ALL ON public.store_cart_fills FROM anon, authenticated;

COMMENT ON TABLE public.store_connections IS 'Sesiones cifradas de supermercado por familia. Nunca contraseñas.';
COMMENT ON TABLE public.store_cart_fills IS 'Resultado de llenar el carro real desde un proposed_cart aprobado. AVI nunca paga.';
