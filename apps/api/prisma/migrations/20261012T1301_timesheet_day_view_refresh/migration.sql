-- `CREATE VIEW ... AS SELECT d.*, ...` congela la lista de columnas al
-- momento de crearse (confirmado en vivo: `ALTER TABLE ADD COLUMN` de la
-- migración anterior no apareció en la vista hasta recrearla). Se repite el
-- mismo SELECT de la migración original más las dos columnas nuevas.

DROP VIEW operations.vw_timesheet_day;

CREATE VIEW operations.vw_timesheet_day AS
SELECT
  d.*,
  greatest(0, d.gross_minutes - d.lunch_deduction_minutes) AS net_minutes,
  (SELECT (EXTRACT(EPOCH FROM (
             max(p.server_at) FILTER (WHERE p.type = 'LUNCH_IN') -
             max(p.server_at) FILTER (WHERE p.type = 'LUNCH_OUT')))/60)::int
     FROM operations.punch_mark p
    WHERE p.timesheet_day_id = d.id) AS actual_lunch_minutes
FROM operations.timesheet_day d;

GRANT SELECT ON operations.vw_timesheet_day TO app_user;
