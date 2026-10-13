-- Segundo consolidado para el mismo colaborador, hotel y semana (decisión de
-- Hugo, 2026-10-06). Las horas aprobadas después del corte del miércoles se
-- pagan en la emergencia del jueves en un consolidado propio (EMERGENCY), sin
-- tocar el REGULAR, que pudo estar ya validado o autorizado.
--
-- Datos existentes: ninguno que migrar. Dev y prod tienen cero consolidados al
-- escribir esto; la columna nueva entra con DEFAULT 'REGULAR', así que cualquier
-- fila que hubiera quedaría como corte del miércoles (lo correcto para ella).
-- El índice viejo se reemplaza en el mismo paso: nunca hay un momento sin
-- unicidad.

ALTER TABLE settlement.consolidation
  ADD COLUMN run_kind text NOT NULL DEFAULT 'REGULAR',
  ADD CONSTRAINT ck_consolidation_run_kind CHECK (run_kind IN ('REGULAR', 'EMERGENCY'));

DROP INDEX settlement.ux_consolidation_worker_hotel_week;

CREATE UNIQUE INDEX ux_consolidation_worker_hotel_week_kind
  ON settlement.consolidation (worker_id, hotel_id, week_start, run_kind);
