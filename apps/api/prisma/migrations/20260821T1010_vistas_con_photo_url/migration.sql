-- Recrear las dos vistas para que vean photo_url.
--
-- Una vista declarada con `SELECT w.*` CONGELA la lista de columnas al
-- crearse: Postgres la expande en ese momento. Agregar una columna a la tabla
-- no la agrega a la vista, y como el API lee personal.vw_worker, la migracion
-- anterior dejo la columna existiendo y a la vez invisible.
--
-- No sirve CREATE OR REPLACE: photo_url cae a media lista de w.* y eso cambia
-- las posiciones ordinales, que REPLACE no permite mover. Van DROP y CREATE, y
-- vw_pool primero por depender de vw_worker.

DROP VIEW IF EXISTS coverage.vw_pool;
DROP VIEW IF EXISTS personal.vw_worker;

CREATE VIEW personal.vw_worker AS
SELECT
  w.*,
  (w.ssn_encrypted IS NOT NULL OR w.itin_encrypted IS NOT NULL) AS has_tax_id,
  (
    w.catalog_position_id            IS NOT NULL AND
    w.english_level_id               IS NOT NULL AND
    w.hiring_modality_id             IS NOT NULL AND
    w.experience_level               IS NOT NULL AND
    w.transport_type                 IS NOT NULL AND
    w.emergency_contact_name         IS NOT NULL AND
    w.emergency_contact_phone        IS NOT NULL AND
    w.emergency_contact_relationship IS NOT NULL AND
    w.blood_type                     IS NOT NULL
  ) AS is_profile_complete,
  date_part('year', age(w.birth_date))::int AS age
FROM personal.worker w;

GRANT SELECT ON personal.vw_worker TO app_user;

CREATE VIEW coverage.vw_pool AS
SELECT
  w.id,
  w.full_name,
  w.photo_url,
  w.phone,
  w.zone_id,
  w.catalog_position_id,
  w.english_level_id,
  w.hiring_modality_id,
  w.experience_level,
  w.transport_type,
  w.status_light_state_id,
  s.code  AS status_code,
  s.color AS status_color,
  w.is_profile_complete,
  w.age
FROM personal.vw_worker w
JOIN catalogs.status_light_state s
  ON s.id = w.status_light_state_id
 AND s.status_light_code = 'WORKER'
WHERE w.deleted_at IS NULL
  AND s.code IN ('STRONG_GREEN', 'YELLOW')
  AND NOT EXISTS (
    SELECT 1 FROM coverage.blacklist_entry b
     WHERE b.worker_id = w.id AND b.lifted_at IS NULL);

GRANT SELECT ON coverage.vw_pool TO app_user;
