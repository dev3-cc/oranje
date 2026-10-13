-- El descuento de un gasto que Oranje ya cubrió, a petición del colaborador
-- (Hugo, 2026-10-09): es una deducción de verdad, no uniforme/comida/retención
-- — la lista cerrada de tipos gana un cuarto valor.

ALTER TABLE settlement.deduction DROP CONSTRAINT ck_deduction_type;

ALTER TABLE settlement.deduction
  ADD CONSTRAINT ck_deduction_type CHECK (
    type = ANY (ARRAY['UNIFORM', 'MEALS', 'TAX_RETENTION', 'PAY_ADJUSTMENT'])
  );
