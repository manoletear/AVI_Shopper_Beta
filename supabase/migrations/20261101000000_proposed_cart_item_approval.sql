-- MCP de AVI: decisión del aprobador por ítem del carro propuesto.
-- Idempotente. Solo agrega una columna nullable (null = pendiente).
-- Aplicar ANTES de desplegar el código: Prisma ya lee esta columna.
ALTER TABLE public.proposed_cart_items
  ADD COLUMN IF NOT EXISTS approved boolean;
