-- Hugo, 2026-09-30: el plazo de SSN/ITIN deja de correr aparte (desde la
-- primera asignacion, sin casilla) y se une al de "Validacion con
-- expediente incompleto" -- una sola cosa que el colaborador completa desde
-- su app, con un solo plazo (ahora 1 dia). El SSN/ITIN se vuelve una quinta
-- condicion de `is_profile_complete`, igual que transporte o tipo de
-- sangre: sin documento cargado, el expediente esta a medias.
--
-- Las dos vistas van otra vez por lo de siempre: personal.vw_worker usa
-- `SELECT w.*` y congelo sus columnas al crearse.

DROP VIEW IF EXISTS coverage.vw_pool;
DROP VIEW IF EXISTS personal.vw_worker;

CREATE VIEW personal.vw_worker AS
SELECT
  w.*,
  (w.ssn_encrypted IS NOT NULL OR w.itin_encrypted IS NOT NULL) AS has_tax_id,
  EXISTS (
    SELECT 1 FROM personal.worker_document wd
     WHERE wd.worker_id = w.id AND wd.document_type = 'SSN_ITIN'
  ) AS has_tax_document,
  (
    w.catalog_position_id            IS NOT NULL AND
    w.english_level_id               IS NOT NULL AND
    w.hiring_modality_id             IS NOT NULL AND
    w.experience_level               IS NOT NULL AND
    w.transport_type                 IS NOT NULL AND
    w.emergency_contact_name         IS NOT NULL AND
    w.emergency_contact_phone        IS NOT NULL AND
    w.emergency_contact_relationship IS NOT NULL AND
    w.blood_type                     IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM personal.worker_document wd
       WHERE wd.worker_id = w.id AND wd.document_type = 'SSN_ITIN'
    )
  ) AS is_profile_complete,
  date_part('year', age(w.birth_date))::int AS age
FROM personal.worker w;

GRANT SELECT ON personal.vw_worker TO app_user;

CREATE VIEW coverage.vw_pool AS
SELECT
  w.id,
  w.full_name,
  w.photo_path,
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
