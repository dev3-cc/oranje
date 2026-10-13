-- El día se guarda por fecha calendario de CADA marca (D-08), así que un
-- turno que cruza medianoche —entra a las 10pm, sale a las 6am— queda
-- partido en dos días: uno con entrada sin salida, el siguiente con salida
-- sin entrada, los dos marcados como anomalía con 0 horas, aunque el turno
-- sea válido (Hugo, 2026-10-12: "que pasa cuando trabaja más de las 12").
-- Estas dos columnas dejan rastro de cuándo el servicio los emparejó solo:
-- exactamente una puede ser true a la vez, nunca las dos.

ALTER TABLE operations.timesheet_day
  ADD COLUMN continues_next_day         boolean NOT NULL DEFAULT false,
  ADD COLUMN continues_from_previous_day boolean NOT NULL DEFAULT false;

ALTER TABLE operations.timesheet_day
  ADD CONSTRAINT ck_timesheet_day_overnight_exclusive
  CHECK (NOT (continues_next_day AND continues_from_previous_day));
