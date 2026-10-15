-- El ajuste de tarifa o el gasto extra (p. ej. «Uber») de una asignación
-- EVENTUAL (Hugo, 2026-10-08): Reclutamiento lo captura al llenar el slot,
-- queda PENDING, y SOLO el Observador (ROL-OBS-01) lo aprueba — excepción
-- deliberada a que el Observador es, por lo demás, de puro lectura
-- (2026-09-21). Hasta que se aprueba no pesa en ningún cálculo de nómina.
--
-- Una fila por ajuste, no una por asignación: un mismo slot eventual puede
-- llevar el ajuste de tarifa Y un gasto de Uber, cada uno con su propia
-- aprobación — por eso no hay UNIQUE sobre assignment_id.
--
-- pay_concept_id NULO = ajuste del rate llano (pisa la tarifa de esa
-- posición para esta asignación); CON VALOR = el gasto del concepto (Uber,
-- lo que el Administrador agregue al catálogo catalogs.pay_concept).

CREATE TABLE coverage.assignment_pay_adjustment (
  id                uuid PRIMARY KEY,
  assignment_id     uuid NOT NULL
                       REFERENCES coverage.assignment(id) ON DELETE RESTRICT,
  pay_concept_id    uuid
                       REFERENCES catalogs.pay_concept(id) ON DELETE RESTRICT,
  amount            numeric(10,2) NOT NULL,
  reason            text NOT NULL,

  status            text NOT NULL DEFAULT 'PENDING',

  requested_by      uuid NOT NULL REFERENCES identity."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  requested_at      timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

  approved_by       uuid REFERENCES identity."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  approved_at       timestamp(6) with time zone,
  rejection_reason  text,

  created_at        timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        timestamp(6) with time zone,

  CONSTRAINT ck_assignment_pay_adjustment_amount CHECK (amount > 0),
  CONSTRAINT ck_assignment_pay_adjustment_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  -- Quien aprueba/rechaza y cuándo viaja junto con el estado: un PENDING no
  -- puede llevar firma, y un resuelto no puede carecer de ella. El motivo de
  -- rechazo es solo de REJECTED — aprobar no necesita explicarse.
  CONSTRAINT ck_assignment_pay_adjustment_resolution CHECK (
    (status = 'PENDING'  AND approved_by IS NULL     AND approved_at IS NULL     AND rejection_reason IS NULL)
    OR (status = 'APPROVED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND rejection_reason IS NULL)
    OR (status = 'REJECTED' AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND rejection_reason IS NOT NULL)
  )
);

CREATE INDEX ix_assignment_pay_adjustment_assignment
  ON coverage.assignment_pay_adjustment (assignment_id);

-- La cola del Observador: todos los PENDING, del más viejo al más nuevo, de
-- cualquier hotel — sin este índice parcial sería un seq scan creciente.
CREATE INDEX ix_assignment_pay_adjustment_pending
  ON coverage.assignment_pay_adjustment (requested_at)
  WHERE status = 'PENDING';

CREATE TRIGGER tg_assignment_pay_adjustment_updated_at
  BEFORE UPDATE ON coverage.assignment_pay_adjustment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
