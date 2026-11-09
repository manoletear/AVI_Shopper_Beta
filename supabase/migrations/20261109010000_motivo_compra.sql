-- Motivo de la compra: para_la_casa, asado, cumple, carrete, dieciocho, navidad, lo_que_falto, colaciones
-- Permite separar consumo cotidiano de eventos puntuales.
ALTER TABLE public.purchase_history ADD COLUMN IF NOT EXISTS motivo TEXT DEFAULT 'para_la_casa';
ALTER TABLE public.proposed_carts ADD COLUMN IF NOT EXISTS motivo TEXT DEFAULT 'para_la_casa';
