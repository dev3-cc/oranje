-- ============================================================================
-- 1. Los siete esquemas que faltaban.
--
-- Prisma solo emite CREATE SCHEMA para los esquemas que YA tienen modelos, asi
-- que estos siete existian en la base de desarrollo porque alguien los creo a
-- mano: no habia migracion que los recreara. Una base nueva --staging, produccion,
-- la shadow database-- se quedaba sin ellos.
--
-- Van vacios a proposito. Las tablas de cada modulo entran con su diagrama
-- aprobado, no antes (D-15).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "demand";
CREATE SCHEMA IF NOT EXISTS "coverage";
CREATE SCHEMA IF NOT EXISTS "operations";
CREATE SCHEMA IF NOT EXISTS "settlement";
CREATE SCHEMA IF NOT EXISTS "supervision";
CREATE SCHEMA IF NOT EXISTS "journal";
CREATE SCHEMA IF NOT EXISTS "notifications";

-- Que guarda cada uno, para que el esquema vacio no parezca un descuido:
--   demand         Requisicion y sus posiciones
--   coverage       Colaborador (worker), pool y asignacion
--   operations     Ponche, schedule y timesheet
--   settlement     Nomina, consolidado y facturacion
--   supervision    QA e inspeccion
--   journal        Bitacora inmutable (RR-16)
--   notifications  Avisos y plantillas
--
-- Sin COMMENT ON SCHEMA a proposito: los esquemas son de `postgres` y
-- `oranje_dev` no puede comentarlos sin ser dueno. Comentar cuesta un privilegio
-- que no vale la pena pedir por una linea de documentacion.

-- ============================================================================
-- 2. Devuelve el indice espacial de la geocerca.
--
-- `identity_y_hotel` lo creo a mano y `ventas_pipeline` lo borro: Prisma genera
-- un DROP de todo indice que no este declarado en el datamodel, y este no lo
-- estaba porque cae sobre una columna `Unsupported`. La base quedo sin el desde
-- el 2026-08-08.
--
-- Ahora si esta declarado en schema.prisma con `type: Gist`, asi que Prisma lo
-- reconoce como suyo y ya no lo vuelve a borrar. Sin este indice, cada ST_DWithin
-- del ponche recorre la tabla `hotel` completa (D-08).
-- ============================================================================

CREATE INDEX IF NOT EXISTS "ix_hotel_coordinates"
  ON "commercial"."hotel" USING GIST ("coordinates" gist_geography_ops);
