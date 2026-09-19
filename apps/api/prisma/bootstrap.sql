-- Lo que tiene que existir ANTES de la primera migracion.
--
-- Varias migraciones hacen GRANT a app_user y ninguna lo crea. En Postgres los
-- roles son del CLUSTER y no de la base, asi que en la instancia de desarrollo
-- el replay funciona —el rol se creo a mano el 2026-08-08 y sigue ahi— pero en
-- un cluster limpio, como el contenedor de CI, muere con
-- «role "app_user" does not exist».
--
-- Las extensiones si son por base, y las migraciones ya las declaran con IF NOT
-- EXISTS. Se repiten aqui para que una base recien creada quede utilizable sin
-- depender del orden.
--
-- Se ejecuta una sola vez por base, antes de `prisma migrate deploy`.
-- Idempotente: correrlo de nuevo no hace nada.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    -- Sin contrasena aqui: en la nube la pone Secret Manager (D-07) y en CI el
    -- workflow. Este script solo garantiza que el rol exista.
    CREATE ROLE app_user LOGIN;
  END IF;
END
$$;

-- La aplicacion no crea ni altera nada: solo DML. Las tablas son del dueno de
-- los esquemas, que es quien corre las migraciones.
--
-- GRANT ON DATABASE no acepta CURRENT_CATALOG, asi que el nombre se arma en un
-- DO: el script tiene que servir en cualquier base sin editarlo.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_user', current_database());
END
$$;

-- Las tres extensiones que el esquema necesita. postgis para la geocerca y las
-- coordenadas, btree_gist para mezclar el = de un uuid con el && de un rango en
-- la misma restriccion de exclusion, pgcrypto para gen_random_uuid.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
