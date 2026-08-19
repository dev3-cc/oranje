-- Los permisos de app_user sobre los esquemas, DESPUES de las migraciones.
--
-- Van aparte de bootstrap.sql porque los esquemas los crean las migraciones: no
-- se puede otorgar sobre algo que todavia no existe.
--
-- Existian solo en la sesion de psql de quien preparo la instancia el
-- 2026-08-08. El repo no los tenia, asi que una base nueva quedaba con las
-- tablas creadas y la aplicacion sin poder leer una sola fila. Se noto por
-- primera vez con `personal` —una asignacion moria con 42501— y se parcho ahi
-- con una migracion; el resto seguia sin respaldo hasta que CI replico desde
-- cero y lo dijo.
--
-- Idempotente. Se corre despues de cada `prisma migrate deploy`, porque una
-- migracion nueva crea tablas que aun no estan cubiertas por los privilegios
-- por omision si el esquema es nuevo.

DO $$
DECLARE
  esquema text;
BEGIN
  FOREACH esquema IN ARRAY ARRAY[
    'catalogs', 'commercial', 'coverage', 'demand', 'identity', 'journal',
    'notifications', 'operations', 'personal', 'settlement', 'supervision'
  ]
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO app_user', esquema);

    -- Solo DML. La aplicacion no crea ni altera estructura: eso es del dueno de
    -- los esquemas, que es quien corre las migraciones.
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO app_user',
      esquema);

    EXECUTE format(
      'GRANT SELECT ON ALL SEQUENCES IN SCHEMA %I TO app_user', esquema);

    -- Para las tablas que cree la SIGUIENTE migracion.
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I
         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user',
      esquema);
  END LOOP;
END
$$;

-- RR-16: el journal no se corrige. Se quita lo que el bucle acaba de dar.
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA journal FROM app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA journal
  REVOKE UPDATE, DELETE ON TABLES FROM app_user;
