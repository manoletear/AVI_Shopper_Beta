-- Un solo uso garantizado para invitaciones
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_invites_code_unique
  ON public.member_invites("codeHash");

-- CHECK de roles válidos
DO $$ BEGIN
  ALTER TABLE public.member_tokens
    ADD CONSTRAINT chk_member_tokens_role CHECK (role IN ('approver','member','viewer'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.member_invites
    ADD CONSTRAINT chk_member_invites_role CHECK (role IN ('approver','member','viewer'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Label en invitaciones (se propaga al token al canjear)
ALTER TABLE public.member_invites
  ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'default';

-- Atribución por ítem: quién aprobó cada producto
ALTER TABLE public.proposed_cart_items
  ADD COLUMN IF NOT EXISTS "approvedByMemberId" TEXT REFERENCES public.family_members(id),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ;
