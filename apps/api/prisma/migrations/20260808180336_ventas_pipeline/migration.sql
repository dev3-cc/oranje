-- DropIndex
DROP INDEX "commercial"."ix_hotel_coordinates";

-- CreateTable
CREATE TABLE "commercial"."hotel_contact" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "job_title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."prospect" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "need_description" TEXT,
    "onboarding_state_id" UUID NOT NULL,
    "status_light_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "close_reason_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."prospect_state_history" (
    "id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "from_state_id" UUID,
    "to_state_id" UUID NOT NULL,
    "reason_id" UUID,
    "user_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."contact_attempt" (
    "id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "hotel_contact_id" UUID,
    "attempt_type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."proposal" (
    "id" UUID NOT NULL,
    "prospect_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "services_note" TEXT,
    "pay_rate" DECIMAL(10,4),
    "bill_rate" DECIMAL(10,4),
    "sent_by_user_id" UUID,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."user_zone" (
    "user_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_zone_pkey" PRIMARY KEY ("user_id","zone_id")
);

-- CreateIndex
CREATE INDEX "ix_hotel_contact_hotel" ON "commercial"."hotel_contact"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_hotel_contact_id_hotel" ON "commercial"."hotel_contact"("id", "hotel_id");

-- CreateIndex
CREATE INDEX "ix_prospect_state" ON "commercial"."prospect"("onboarding_state_id");

-- CreateIndex
CREATE INDEX "ix_prospect_owner" ON "commercial"."prospect"("owner_user_id");

-- CreateIndex
CREATE INDEX "ix_prospect_hotel" ON "commercial"."prospect"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_prospect_id_hotel" ON "commercial"."prospect"("id", "hotel_id");

-- CreateIndex
CREATE INDEX "ix_state_history_prospect" ON "commercial"."prospect_state_history"("prospect_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_contact_attempt_prospect" ON "commercial"."contact_attempt"("prospect_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_contact_attempt_hotel" ON "commercial"."contact_attempt"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_proposal_prospect_version" ON "commercial"."proposal"("prospect_id", "version");

-- CreateIndex
CREATE INDEX "ix_user_zone_zone" ON "commercial"."user_zone"("zone_id");

-- AddForeignKey
ALTER TABLE "commercial"."hotel_contact" ADD CONSTRAINT "hotel_contact_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect" ADD CONSTRAINT "prospect_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect" ADD CONSTRAINT "prospect_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect" ADD CONSTRAINT "prospect_onboarding_state_id_status_light_id_fkey" FOREIGN KEY ("onboarding_state_id", "status_light_id") REFERENCES "catalogs"."status_light_state"("id", "status_light_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect" ADD CONSTRAINT "prospect_close_reason_id_fkey" FOREIGN KEY ("close_reason_id") REFERENCES "catalogs"."status_change_reason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect_state_history" ADD CONSTRAINT "prospect_state_history_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "commercial"."prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect_state_history" ADD CONSTRAINT "prospect_state_history_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "catalogs"."status_light_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect_state_history" ADD CONSTRAINT "prospect_state_history_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "catalogs"."status_light_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect_state_history" ADD CONSTRAINT "prospect_state_history_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "catalogs"."status_change_reason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."prospect_state_history" ADD CONSTRAINT "prospect_state_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contact_attempt" ADD CONSTRAINT "contact_attempt_prospect_id_hotel_id_fkey" FOREIGN KEY ("prospect_id", "hotel_id") REFERENCES "commercial"."prospect"("id", "hotel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contact_attempt" ADD CONSTRAINT "contact_attempt_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contact_attempt" ADD CONSTRAINT "contact_attempt_hotel_contact_id_hotel_id_fkey" FOREIGN KEY ("hotel_contact_id", "hotel_id") REFERENCES "commercial"."hotel_contact"("id", "hotel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."contact_attempt" ADD CONSTRAINT "contact_attempt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."proposal" ADD CONSTRAINT "proposal_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "commercial"."prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."proposal" ADD CONSTRAINT "proposal_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."user_zone" ADD CONSTRAINT "user_zone_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."user_zone" ADD CONSTRAINT "user_zone_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "catalogs"."zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Las restricciones que sostienen el modelo. Escritas a mano: Prisma no expresa
-- indices unicos parciales, CHECK ni vistas.
-- Referencia: pagina 3 de "Ventas - Modelo de Datos v2.drawio".
-- ============================================================================

-- 1. Un hotel no puede tener dos ciclos comerciales abiertos.
--    Sin esto, dos BD trabajan el mismo hotel sin saberlo.
CREATE UNIQUE INDEX ux_prospect_hotel_open
  ON "commercial"."prospect" (hotel_id) WHERE closed_at IS NULL;

-- 3. Un solo contacto principal por hotel.
CREATE UNIQUE INDEX ux_hotel_contact_primary
  ON "commercial"."hotel_contact" (hotel_id) WHERE is_primary;

-- 4. Coherencia dentro de la propia fila.
ALTER TABLE "commercial"."prospect"
  ADD CONSTRAINT ck_prospect_closed_after_opened
    CHECK (closed_at IS NULL OR closed_at >= opened_at),
  ADD CONSTRAINT ck_prospect_close_reason_con_fecha
    CHECK ((closed_at IS NULL AND close_reason_id IS NULL)
        OR (closed_at IS NOT NULL));

-- 7. La historia del semaforo no registra un paso hacia el mismo estado.
ALTER TABLE "commercial"."prospect_state_history"
  ADD CONSTRAINT ck_state_history_no_self
    CHECK (from_state_id IS DISTINCT FROM to_state_id);

-- 9. Listas cerradas con CHECK en vez de tabla catalogo (Estandares de BD §5):
--    no hay pantalla donde el negocio agregue un canal ni un resultado.
--    Agregar WhatsApp es una migracion de una linea, no un INSERT.
ALTER TABLE "commercial"."contact_attempt"
  ADD CONSTRAINT ck_contact_attempt_type
    CHECK (attempt_type IN ('COLD_VISIT', 'CALL', 'EMAIL')),
  ADD CONSTRAINT ck_contact_attempt_outcome
    CHECK (outcome IN ('NO_ANSWER', 'INTERESTED', 'NOT_INTERESTED', 'MEETING_SET'));

-- 8. Dinero: tarifas positivas.
ALTER TABLE "commercial"."proposal"
  ADD CONSTRAINT ck_proposal_rate_positive
    CHECK ((pay_rate IS NULL OR pay_rate > 0) AND (bill_rate IS NULL OR bill_rate > 0));

-- updated_at lo mantiene el motor (§4).
CREATE TRIGGER tg_hotel_contact_updated_at BEFORE UPDATE ON "commercial"."hotel_contact"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_prospect_updated_at BEFORE UPDATE ON "commercial"."prospect"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_proposal_updated_at BEFORE UPDATE ON "commercial"."proposal"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- "Es cliente?" se resuelve con una vista, no con una columna (D-13): es un
-- join, asi que no hay nada que se pueda desincronizar.
CREATE VIEW "commercial"."vw_client" AS
SELECT h.*
FROM "commercial"."hotel" h
JOIN "commercial"."prospect" p
  ON p.hotel_id = h.id AND p.closed_at IS NULL
JOIN "catalogs"."status_light_state" s
  ON s.id = p.onboarding_state_id
WHERE s.code IN ('ORANGE', 'BLACK');

COMMENT ON VIEW "commercial"."vw_client"
  IS 'D-13: hoteles cuyo ciclo abierto esta en ORANGE o BLACK. Naranja y Negro son estados de un hotel que YA es cliente.';
COMMENT ON COLUMN "commercial"."contact_attempt".hotel_id
  IS 'Redundante a proposito: sostiene las dos FK compuestas que impiden citar el contacto de otro hotel.';
COMMENT ON COLUMN "commercial"."prospect".status_light_id
  IS 'Redundante a proposito: la FK compuesta impide que un prospecto tome un estado de otro semaforo.';
