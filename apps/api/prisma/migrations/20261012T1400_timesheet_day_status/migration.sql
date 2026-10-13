-- Catálogo del Administrador: con qué se marca un día del Timesheet sin
-- ponches antes de enviarlo a aprobación. Sin Schedule (beta "Ponche por
-- Horario" apagada, 2026-09-23) nada más dice si un día vacío fue descanso o
-- permiso. Decisión de Hugo (2026-10-12).
CREATE TABLE catalogs.timesheet_day_status (
  id         uuid PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- NULO = el día tiene ponches, o todavía no se marcó.
ALTER TABLE operations.timesheet_day
  ADD COLUMN day_status_id uuid NULL
  REFERENCES catalogs.timesheet_day_status (id) ON DELETE RESTRICT;
