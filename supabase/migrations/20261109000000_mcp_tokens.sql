-- Tokens MCP por familia. Reemplaza el env var AVI_MCP_TOKENS.
-- tokenHash es sha256 hex del token plano (64 chars). El token plano se muestra una sola vez.
CREATE TABLE IF NOT EXISTS public.mcp_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "familyId" TEXT NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL,
  label TEXT DEFAULT 'default',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastUsedAt" TIMESTAMPTZ
);

CREATE INDEX idx_mcp_tokens_family ON public.mcp_tokens("familyId");
CREATE INDEX idx_mcp_tokens_hash ON public.mcp_tokens("tokenHash") WHERE "isActive" = true;

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_tokens_family" ON public.mcp_tokens
  FOR ALL USING ("familyId" IN (
    SELECT fm."familyId" FROM public.family_members fm WHERE fm."userId" = auth.uid()
  ));
