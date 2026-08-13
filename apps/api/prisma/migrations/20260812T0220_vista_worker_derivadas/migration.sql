-- Las dos derivadas se mudan de columna GENERATED a VISTA.
--
-- El intento anterior fue columnas GENERATED ALWAYS AS ... STORED, y funcionaban
-- perfecto en Postgres. El problema es Prisma: no sabe representar una columna
-- generada, asi que su diff quedaba en un bucle imposible —
--
--   sin declararlas   -> propone DROP COLUMN (perdida de datos)
--   declaradas        -> propone DROP DEFAULT  (Postgres: "column is a
--                        generated column", falla)
--   con @default      -> propone SET DEFAULT   (mismo error)
--
-- y cualquiera de los tres rompe la siguiente migracion. Una vista consigue lo
-- mismo que buscabamos —la derivacion vive en la base y no se puede
-- desincronizar— y Prisma la ignora, asi que no hay drift.

ALTER TABLE personal.worker
  DROP COLUMN has_tax_id,
  DROP COLUMN is_profile_complete;

CREATE VIEW personal.vw_worker AS
SELECT
  w.*,
  -- Sin SSN ni ITIN se activa la retencion del 16% (reembolsable).
  (w.ssn_encrypted IS NOT NULL OR w.itin_encrypted IS NOT NULL) AS has_tax_id,
  -- Los 8 campos que 10 - Validaciones marca obligatorios. No pueden ser NOT
  -- NULL porque los datos llegan en TRES fases y entre una y otra la fila existe
  -- a medias — eso ES el estado Blanco. Esto es lo que lee el guard de la
  -- transicion Blanco -> Verde fuerte.
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
  -- La edad se CALCULA. Colaborador.md pide "Edad" pero guardarla es guardar un
  -- dato que se vuelve falso solo.
  date_part('year', age(w.birth_date))::int AS age
FROM personal.worker w;

GRANT SELECT ON personal.vw_worker TO app_user;
