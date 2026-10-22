-- Referencia a la Propuesta de la que nace el Contrato (Hugo, 2026-10-21):
-- "no puede haber contrato sin propuesta". Nullable igual que prospect_id, por
-- la misma razón ya documentada ahí: un contrato heredado o migrado puede no
-- tener propuesta detrás.
ALTER TABLE commercial.contract
  ADD COLUMN proposal_id uuid NULL REFERENCES commercial.proposal (id);

CREATE INDEX ix_contract_proposal ON commercial.contract (proposal_id);
