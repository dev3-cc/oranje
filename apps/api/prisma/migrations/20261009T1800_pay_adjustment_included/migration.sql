-- Que el Observador apruebe un ajuste/gasto no significa que ya se cuente en
-- la nómina: Contabilidad decide si lo incluye, con la explicación de qué
-- hace delante (Hugo, 2026-10-09). Hasta que alguien de Contabilidad lo
-- incluye, un ajuste APPROVED sigue sin pesar en ningún cálculo — igual que
-- hoy pesa en cero mientras está PENDING.

ALTER TABLE coverage.assignment_pay_adjustment
  ADD COLUMN included_at timestamp(6) with time zone,
  ADD COLUMN included_by uuid REFERENCES identity."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE coverage.assignment_pay_adjustment
  ADD CONSTRAINT ck_assignment_pay_adjustment_included CHECK (
    (included_at IS NULL AND included_by IS NULL)
    OR (included_at IS NOT NULL AND included_by IS NOT NULL AND status = 'APPROVED')
  );

-- La cola de Contabilidad: todo lo APPROVED y sin incluir, del más viejo al
-- más nuevo — mismo criterio que la cola PENDING del Observador.
CREATE INDEX ix_assignment_pay_adjustment_approved_pending_inclusion
  ON coverage.assignment_pay_adjustment (approved_at)
  WHERE status = 'APPROVED' AND included_at IS NULL;
