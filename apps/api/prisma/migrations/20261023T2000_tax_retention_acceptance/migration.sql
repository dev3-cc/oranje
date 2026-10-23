-- Hugo, 2026-10-23: Reclutamiento puede aceptar la retención del 16% en vez
-- de pedirle el SSN/ITIN al colaborador. Antes de construirlo se preguntó si
-- eso chocaba con el plazo del expediente a medias (AccessDeadlineGuard,
-- PROFILE_OVERDUE) — y sí chocaba: has_tax_document solo miraba si existía
-- el documento, así que aceptar la retención sin tocar esto habría bloqueado
-- el acceso del colaborador a los pocos días por no subir un documento que
-- ya no se le estaba pidiendo. has_tax_id NO se toca a propósito: la
-- retención debe seguir aplicando, es justo lo que se está aceptando.

ALTER TABLE personal.worker
  ADD COLUMN tax_retention_accepted_at TIMESTAMPTZ NULL,
  ADD COLUMN tax_retention_accepted_by UUID NULL REFERENCES identity."user" (id) ON DELETE RESTRICT;

DROP VIEW IF EXISTS coverage.vw_pool;
DROP VIEW IF EXISTS personal.vw_worker;

CREATE VIEW personal.vw_worker AS
SELECT
  w.*,
  (
    w.ssn_encrypted IS NOT NULL OR w.itin_encrypted IS NOT NULL OR EXISTS (
      SELECT 1 FROM personal.worker_document wd
       WHERE wd.worker_id = w.id AND wd.document_type = 'SSN_ITIN' AND wd.verified_at IS NOT NULL
    )
  ) AS has_tax_id,
  (
    EXISTS (
      SELECT 1 FROM personal.worker_document wd
       WHERE wd.worker_id = w.id AND wd.document_type = 'SSN_ITIN'
    ) OR w.tax_retention_accepted_at IS NOT NULL
  ) AS has_tax_document,
  EXISTS (
    SELECT 1 FROM personal.worker_document wd
     WHERE wd.worker_id = w.id AND wd.document_type = 'SSN_ITIN' AND wd.verified_at IS NULL
  ) AS has_pending_tax_document,
  (
    w.catalog_position_id            IS NOT NULL AND
    w.english_level_id               IS NOT NULL AND
    w.hiring_modality_id             IS NOT NULL AND
    w.experience_level                IS NOT NULL AND
    w.transport_type                 IS NOT NULL AND
    w.emergency_contact_name         IS NOT NULL AND
    w.emergency_contact_phone        IS NOT NULL AND
    w.emergency_contact_relationship IS NOT NULL AND
    w.blood_type                     IS NOT NULL AND
    (
      EXISTS (
        SELECT 1 FROM personal.worker_document wd
         WHERE wd.worker_id = w.id AND wd.document_type = 'SSN_ITIN'
      ) OR w.tax_retention_accepted_at IS NOT NULL
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
