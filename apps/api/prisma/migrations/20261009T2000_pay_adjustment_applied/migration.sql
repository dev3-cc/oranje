-- Que Contabilidad lo incluya (included_at) es la DECISIÓN, de una persona.
-- Que la corrida de pago lo haya tomado en cuenta de verdad es otro hecho
-- aparte, del sistema: applied_at. Separarlos es lo que hace la corrida
-- idempotente — correrla dos veces no debe sumar el mismo gasto dos veces,
-- igual que ya pasa con las horas (Hugo, 2026-10-09).

ALTER TABLE coverage.assignment_pay_adjustment
  ADD COLUMN applied_at timestamp(6) with time zone;

ALTER TABLE coverage.assignment_pay_adjustment
  ADD CONSTRAINT ck_assignment_pay_adjustment_applied CHECK (
    applied_at IS NULL OR included_at IS NOT NULL
  );
