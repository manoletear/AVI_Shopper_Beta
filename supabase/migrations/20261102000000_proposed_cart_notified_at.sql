-- Migration: add notifiedAt to proposed_carts for email idempotency
-- Idempotent. Schema: public only.

DO $$ BEGIN
  ALTER TABLE public.proposed_carts ADD COLUMN "notifiedAt" timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

COMMENT ON COLUMN public.proposed_carts."notifiedAt" IS 'Timestamp del envío del correo al aprobador. Null = no enviado. Evita envíos duplicados.';
