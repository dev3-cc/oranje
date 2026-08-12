-- ============================================================================
-- journal.journal — la bitacora inmutable. RR-16.
-- Especificacion: _Globales/Journal - Modelo de Datos.drawio
--
-- PARTICIONADA POR MES desde su creacion, no despues. La seccion 9 de
-- Estandares de Base de Datos: "particionar despues significa reescribir la
-- tabla entera con la aplicacion detenida". Hoy esta vacia y cuesta cero.
--
-- No es por volumen: es por forma. Append-only, siempre consultada por rango de
-- fecha, y con una retencion que es politica y no decision tecnica.
--
-- Prisma no expresa particionado, asi que el PARTITION BY se escribe a mano.
-- Para Prisma esta es una tabla normal; el particionado le es invisible.
-- ============================================================================

-- CreateTable
CREATE TABLE "journal"."journal" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" UUID,
    "actor_role" TEXT,
    "payload" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_pkey" PRIMARY KEY ("id","occurred_at")
) PARTITION BY RANGE ("occurred_at");

-- CreateIndex
CREATE INDEX "ix_journal_entity" ON "journal"."journal"("entity_type", "entity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_journal_actor" ON "journal"."journal"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_journal_event" ON "journal"."journal"("event_type", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "journal"."journal" ADD CONSTRAINT "journal_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ============================================================================
-- Particiones. Postgres NO las crea solo: si no existe la del mes, el INSERT
-- FALLA. Se crean 17 meses por adelantado, hasta 2027-12.
--
-- A proposito NO se crea una particion DEFAULT: atraparia las filas del mes que
-- falte y despues no se podria crear su particion real sin moverlas a mano. Es
-- preferible que falle visible.
--
-- PENDIENTE: el job que las cree. Ver el pendiente 1 de la pagina 2 del diagrama.
-- ============================================================================

CREATE TABLE "journal"."journal_2026_08" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');
CREATE TABLE "journal"."journal_2026_09" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
CREATE TABLE "journal"."journal_2026_10" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE "journal"."journal_2026_11" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE "journal"."journal_2026_12" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_01" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_02" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_03" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_04" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_05" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_06" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_07" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-07-01 00:00:00+00') TO ('2027-08-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_08" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-08-01 00:00:00+00') TO ('2027-09-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_09" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-09-01 00:00:00+00') TO ('2027-10-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_10" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-10-01 00:00:00+00') TO ('2027-11-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_11" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-11-01 00:00:00+00') TO ('2027-12-01 00:00:00+00');
CREATE TABLE "journal"."journal_2027_12" PARTITION OF "journal"."journal"
  FOR VALUES FROM ('2027-12-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

-- ============================================================================
-- Inmutabilidad — RR-16. Se garantiza quitando el permiso, no confiando en la
-- disciplina (seccion 12).
--
-- OJO, DOS LIMITES REALES:
--
-- 1. app_user NO EXISTE todavia. La aplicacion se conecta como oranje_dev, que
--    es DUENO de estas tablas, y un dueno puede borrar lo que quiera. Mientras
--    siga asi, RR-16 es una intencion y no una garantia. El REVOKE queda escrito
--    abajo, comentado, para aplicarse el dia del split de usuarios.
--
-- 2. El REVOKE sobre la tabla padre gobierna el acceso A TRAVES del padre, que
--    es como consulta la aplicacion. Pero cada particion nueva nace con sus
--    propios permisos: quien cree la particion del mes que entra tiene que
--    repetir el revoke, o el agujero aparece sin que nadie lo note.
-- ============================================================================

-- REVOKE UPDATE, DELETE ON "journal"."journal" FROM app_user;

COMMENT ON TABLE "journal"."journal"
  IS 'RR-16: bitacora append-only, particionada por mes. Inmutable por permisos, no por convencion. El vinculo con lo que registra es polimorfico (entity_type + entity_id) y SIN FK a proposito: con ON DELETE CASCADE borrar una fila borraria su propia auditoria.';
COMMENT ON COLUMN "journal"."journal"."entity_id"
  IS 'Sin FK a proposito. Nada valida que apunte a algo real: es el precio de que la bitacora sea independiente de las 23 tablas que registra.';
COMMENT ON COLUMN "journal"."journal"."payload"
  IS 'Seccion 3: jsonb es SOLO para el payload del journal. No se indexa. Si algo hay que consultarlo, es columna.';
COMMENT ON COLUMN "journal"."journal"."occurred_at"
  IS 'Llave de particion, y hace de created_at: en una tabla append-only son el mismo instante.';
