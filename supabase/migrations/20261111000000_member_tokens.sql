-- ================================================================
-- Multi-user MCP tokens: cada integrante tiene su propio token.
-- ================================================================

-- 1. Tokens por integrante
CREATE TABLE IF NOT EXISTS public.member_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "familyId" TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL,
  label TEXT DEFAULT 'default',
  role TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastUsedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ
);

CREATE INDEX idx_member_tokens_family ON public.member_tokens("familyId");
CREATE INDEX idx_member_tokens_hash ON public.member_tokens("tokenHash") WHERE "revokedAt" IS NULL;
CREATE INDEX idx_member_tokens_member ON public.member_tokens("memberId");

ALTER TABLE public.member_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_tokens_family" ON public.member_tokens
  FOR ALL USING ("familyId" IN (
    SELECT fm."familyId" FROM public.family_members fm WHERE fm."userId" = auth.uid()
  ));

-- 2. Invitaciones de un solo uso (vencen en 72 h)
CREATE TABLE IF NOT EXISTS public.member_invites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "familyId" TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  "codeHash" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_invites_code ON public.member_invites("codeHash");

ALTER TABLE public.member_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_invites_family" ON public.member_invites
  FOR ALL USING ("familyId" IN (
    SELECT fm."familyId" FROM public.family_members fm WHERE fm."userId" = auth.uid()
  ));

-- 3. Log de actividad familiar
CREATE TABLE IF NOT EXISTS public.family_activity (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "familyId" TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  "memberId" TEXT REFERENCES public.family_members(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  payload JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_activity_family_date ON public.family_activity("familyId", "createdAt" DESC);
CREATE INDEX idx_family_activity_member ON public.family_activity("memberId");

ALTER TABLE public.family_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_activity_family" ON public.family_activity
  FOR ALL USING ("familyId" IN (
    SELECT fm."familyId" FROM public.family_members fm WHERE fm."userId" = auth.uid()
  ));

-- 4. Atribución en carros propuestos
ALTER TABLE public.proposed_carts
  ADD COLUMN IF NOT EXISTS "proposedByMemberId" TEXT REFERENCES public.family_members(id),
  ADD COLUMN IF NOT EXISTS "approvedByMemberId" TEXT REFERENCES public.family_members(id),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ;
