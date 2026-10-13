-- Corrección manual de Contabilidad sobre la vista previa de pago de una
-- hoja (Hugo, 2026-10-08): tarifa, reparto de horas y el monto final, los
-- tres editables. Una sola corrección vigente por hoja — se corrige
-- reescribiendo la misma fila, no se acumula historial de versiones.
-- El multiplicador de horas extra NO se corrige aquí: sigue resuelto del
-- hotel/contrato, como en la corrida real (si algún día hace falta
-- corregirlo también, es una columna más).

CREATE TABLE settlement.timesheet_pay_override (
  id               uuid PRIMARY KEY,
  timesheet_id     uuid NOT NULL UNIQUE
                     REFERENCES operations.timesheet(id) ON DELETE CASCADE,
  regular_minutes  integer NOT NULL,
  overtime_minutes integer NOT NULL,
  pay_rate         numeric(10,2) NOT NULL,
  -- Calculado por el servidor a partir de las tres columnas de arriba y el
  -- multiplicador resuelto, igual que `consolidation_detail.subtotal`: el
  -- monto nunca lo manda el cliente ya hecho.
  subtotal         numeric(12,2) NOT NULL,
  reason           text NOT NULL,
  created_by       uuid NOT NULL REFERENCES identity."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at       timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by       uuid REFERENCES identity."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  updated_at       timestamp(6) with time zone,
  CONSTRAINT ck_pay_override_values CHECK (
    regular_minutes >= 0 AND overtime_minutes >= 0
    AND pay_rate > 0 AND subtotal >= 0
  )
);

CREATE TRIGGER tg_timesheet_pay_override_updated_at
  BEFORE UPDATE ON settlement.timesheet_pay_override
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
