-- Contrato enviado (Hugo, 2026-10-23): mismo patrón que la Propuesta —
-- «Enviar por correo» o «Marcar como enviado» lo congelan, y un borrador
-- enviado queda bloqueado igual que uno vigente. NULO = no enviado: todos los
-- contratos existentes nacen así, sin backfill (no hay registro de cuáles se
-- mandaron por correo antes de hoy).
ALTER TABLE commercial.contract
  ADD COLUMN sent_at timestamptz,
  ADD COLUMN sent_by uuid;

ALTER TABLE commercial.contract
  ADD CONSTRAINT contract_sent_by_fkey
  FOREIGN KEY (sent_by) REFERENCES identity."user"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
