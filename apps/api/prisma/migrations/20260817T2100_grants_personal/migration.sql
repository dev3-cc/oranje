-- `personal` nacio el 2026-08-12 como el esquema 11 y quedo fuera de los GRANT.
-- Los otros diez tienen USAGE y ALTER DEFAULT PRIVILEGES para app_user; este no,
-- asi que la aplicacion no puede leer un solo renglon de personal.worker y toda
-- asignacion de colaborador falla con 42501.
--
-- La prueba de que fue omision y no diseno: la migracion 20260812T0220 ya hace
-- GRANT SELECT ON personal.vw_worker TO app_user, y ese permiso es inerte
-- mientras falte USAGE sobre el esquema que lo contiene.
--
-- Se otorga lo mismo que a los otros diez. El SSN y el ITIN viven cifrados en
-- columnas bytea (seccion 12), asi que app_user ve texto cifrado, no el dato.

GRANT USAGE ON SCHEMA personal TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA personal
  TO app_user;

ALTER DEFAULT PRIVILEGES
  FOR ROLE oranje_dev IN SCHEMA personal
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
