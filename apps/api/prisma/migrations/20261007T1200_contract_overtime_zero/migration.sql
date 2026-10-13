-- El Hotel ya permite overtime_pay_multiplier = 0 ("No paga horas extra",
-- D-07 2026-10-07). El Contrato lo copia del Hotel al activarse
-- (ContractsService.create), pero su propio CHECK seguía exigiendo >= 1 —
-- crear un contrato para un hotel en 0 habría tronado con 23514 al primer
-- INSERT. Confirmado sin filas afectadas: hoy todo contrato existente tiene
-- overtime_pay_multiplier en 1.0 o 1.5, los dos siguen válidos bajo >= 0.

ALTER TABLE commercial.contract DROP CONSTRAINT ck_contract_multipliers;
ALTER TABLE commercial.contract
  ADD CONSTRAINT ck_contract_multipliers
  CHECK (overtime_bill_multiplier >= 1
     AND overtime_pay_multiplier  >= 0
     AND holiday_bill_multiplier  >= 1
     AND holiday_pay_multiplier   >= 1);

-- Mismo bug, mismo origen: el detalle del consolidado congela el
-- multiplicador aplicado (`overtime_multiplier_applied`) y exigía >= 1.
ALTER TABLE settlement.consolidation_detail DROP CONSTRAINT ck_detail_rate;
ALTER TABLE settlement.consolidation_detail
  ADD CONSTRAINT ck_detail_rate
  CHECK (pay_rate_applied             > 0
     AND overtime_multiplier_applied >= 0
     AND regular_minutes             >= 0
     AND overtime_minutes            >= 0
     AND subtotal                    >= 0);
