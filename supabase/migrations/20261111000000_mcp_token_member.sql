-- Token por persona: cada token identifica familia + integrante
ALTER TABLE public.mcp_tokens ADD COLUMN IF NOT EXISTS "memberId" TEXT REFERENCES public.family_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_member ON public.mcp_tokens("memberId");
