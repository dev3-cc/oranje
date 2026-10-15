-- El hotel captura si paga el lonche (Hugo, 2026-10-14). `true`: las horas
-- quedan completas, nunca se resta nada. `false` (default, el de hoy): se
-- resta el lonche solo si el turno llega a 6.5 h — antes era fijo en 30 min
-- para todo mundo, sin ese piso. `operations.timesheet_day.lunch_deduction_minutes`
-- lo recalcula `recalcDay` leyendo esta columna.

ALTER TABLE commercial.hotel
  ADD COLUMN pays_lunch boolean NOT NULL DEFAULT false;
