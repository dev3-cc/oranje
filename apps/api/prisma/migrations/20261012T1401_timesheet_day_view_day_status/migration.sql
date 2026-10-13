-- La vista lista sus columnas una por una (no `d.*`): sin recrearla,
-- `day_status_id` de la migración anterior queda invisible para quien la
-- consulta, igual que pasó con continues_next_day (20261012T1301).
DROP VIEW operations.vw_timesheet_day;

CREATE VIEW operations.vw_timesheet_day AS
 SELECT d.id,
    d.timesheet_id,
    d.work_date,
    d.gross_minutes,
    d.lunch_deduction_minutes,
    d.overtime_minutes,
    d.is_absence,
    d.has_anomaly,
    d.review_note,
    d.reviewed_by,
    d.reviewed_at,
    d.created_at,
    d.updated_at,
    d.continues_next_day,
    d.continues_from_previous_day,
    d.day_status_id,
    GREATEST(0, d.gross_minutes - d.lunch_deduction_minutes) AS net_minutes,
    ( SELECT (EXTRACT(epoch FROM max(p.server_at) FILTER (WHERE p.type = 'LUNCH_IN'::text) - max(p.server_at) FILTER (WHERE p.type = 'LUNCH_OUT'::text)) / 60::numeric)::integer AS int4
           FROM operations.punch_mark p
          WHERE p.timesheet_day_id = d.id) AS actual_lunch_minutes
   FROM operations.timesheet_day d;
