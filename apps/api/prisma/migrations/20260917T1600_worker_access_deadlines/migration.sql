-- Dos plazos nuevos de tres dias, los dos calculados AL LEER como el del
-- SSN/ITIN (D-33): un job que deja de correr bloquea a nadie o a todos, y la
-- fecha ya dice todo.
--
-- 1) La contraseña temporal. El alta del Pool ahora puede crear el acceso del
--    colaborador (cuenta de Oranje + buzon @oranjepeople.com) con UNA
--    contraseña generada que se muestra una sola vez a la Reclutadora y se
--    entrega en mano: nada viaja por correo, porque el buzon al que llegaria
--    es el que se esta creando. `temp_password_issued_at` corre el plazo para
--    cambiarla desde la app; se limpia al cambiarla. Null = cuenta normal.
--
-- 2) El perfil incompleto. Reglas de Negocio ya permiten validar (Blanco ->
--    Verde fuerte) a un colaborador con expediente a medias si quien valida
--    lo confirma: `profile_due_at` es hasta cuando puede completarlo. Se
--    queda escrito aunque despues se complete; lo que decide si aplica es
--    `is_profile_complete`, que sigue siendo la unica fuente.

ALTER TABLE identity."user" ADD COLUMN temp_password_issued_at timestamp(6) with time zone;

ALTER TABLE personal.worker ADD COLUMN profile_due_at timestamp(6) with time zone;

-- Las dos vistas van otra vez por lo de siempre: personal.vw_worker usa
-- `SELECT w.*` y congelo sus columnas al crearse.

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
