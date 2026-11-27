-- public solamente. No toca ig, ads ni sii_pj.
-- No borra ni modifica filas. Solo agrega un índice para que record_order
-- pueda chequear idempotencia por (familyId, orderRef) de forma eficiente.
-- Dejar SIN aplicar hasta OK de Manuel.

CREATE INDEX IF NOT EXISTS "purchase_history_familyId_orderRef_idx"
  ON public.purchase_history ("familyId", "orderRef");
