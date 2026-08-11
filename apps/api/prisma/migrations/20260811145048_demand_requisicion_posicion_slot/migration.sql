-- CreateTable
CREATE TABLE "catalogs"."position" (
    "id" UUID NOT NULL,
    "hotel_department_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."hiring_modality" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "hiring_modality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."english_level" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "english_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand"."requisition" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "hotel_id" UUID NOT NULL,
    "status_light_state_id" UUID NOT NULL,
    "status_light_id" UUID NOT NULL,
    "area_manager_user_id" UUID,
    "authorized_by" UUID,
    "authorized_at" TIMESTAMPTZ(6),
    "inspector_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand"."position" (
    "id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "catalog_position_id" UUID NOT NULL,
    "hiring_modality_id" UUID NOT NULL,
    "english_level_id" UUID,
    "hotel_department_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "start_time" TIME(0),
    "notes" TEXT,
    "coverage_state_id" UUID NOT NULL,
    "coverage_light_id" UUID NOT NULL,
    "urgency_state_id" UUID,
    "urgency_light_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand"."slot" (
    "id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand"."requisition_state_history" (
    "id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "from_state_id" UUID,
    "to_state_id" UUID NOT NULL,
    "reason_id" UUID,
    "user_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisition_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "position_code_key" ON "catalogs"."position"("code");

-- CreateIndex
CREATE INDEX "ix_position_hotel_department" ON "catalogs"."position"("hotel_department_id");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_modality_code_key" ON "catalogs"."hiring_modality"("code");

-- CreateIndex
CREATE UNIQUE INDEX "english_level_code_key" ON "catalogs"."english_level"("code");

-- CreateIndex
CREATE UNIQUE INDEX "requisition_number_key" ON "demand"."requisition"("number");

-- CreateIndex
CREATE INDEX "ix_requisition_hotel_state" ON "demand"."requisition"("hotel_id", "status_light_state_id");

-- CreateIndex
CREATE INDEX "ix_requisition_inspector" ON "demand"."requisition"("inspector_id");

-- CreateIndex
CREATE INDEX "ix_position_requisition" ON "demand"."position"("requisition_id");

-- CreateIndex
CREATE INDEX "ix_position_urgency" ON "demand"."position"("urgency_state_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_slot_position_ordinal" ON "demand"."slot"("position_id", "ordinal");

-- CreateIndex
CREATE INDEX "ix_requisition_history" ON "demand"."requisition_state_history"("requisition_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "catalogs"."position" ADD CONSTRAINT "position_hotel_department_id_fkey" FOREIGN KEY ("hotel_department_id") REFERENCES "catalogs"."hotel_department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition" ADD CONSTRAINT "requisition_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition" ADD CONSTRAINT "requisition_status_light_state_id_status_light_id_fkey" FOREIGN KEY ("status_light_state_id", "status_light_id") REFERENCES "catalogs"."status_light_state"("id", "status_light_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition" ADD CONSTRAINT "requisition_area_manager_user_id_fkey" FOREIGN KEY ("area_manager_user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition" ADD CONSTRAINT "requisition_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition" ADD CONSTRAINT "requisition_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition" ADD CONSTRAINT "requisition_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition" ADD CONSTRAINT "requisition_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."position" ADD CONSTRAINT "position_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "demand"."requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."position" ADD CONSTRAINT "position_catalog_position_id_fkey" FOREIGN KEY ("catalog_position_id") REFERENCES "catalogs"."position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."position" ADD CONSTRAINT "position_hiring_modality_id_fkey" FOREIGN KEY ("hiring_modality_id") REFERENCES "catalogs"."hiring_modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."position" ADD CONSTRAINT "position_english_level_id_fkey" FOREIGN KEY ("english_level_id") REFERENCES "catalogs"."english_level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."position" ADD CONSTRAINT "position_hotel_department_id_fkey" FOREIGN KEY ("hotel_department_id") REFERENCES "catalogs"."hotel_department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."position" ADD CONSTRAINT "position_coverage_state_id_coverage_light_id_fkey" FOREIGN KEY ("coverage_state_id", "coverage_light_id") REFERENCES "catalogs"."status_light_state"("id", "status_light_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."position" ADD CONSTRAINT "position_urgency_state_id_urgency_light_id_fkey" FOREIGN KEY ("urgency_state_id", "urgency_light_id") REFERENCES "catalogs"."status_light_state"("id", "status_light_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."slot" ADD CONSTRAINT "slot_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "demand"."position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition_state_history" ADD CONSTRAINT "requisition_state_history_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "demand"."requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition_state_history" ADD CONSTRAINT "requisition_state_history_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "catalogs"."status_light_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition_state_history" ADD CONSTRAINT "requisition_state_history_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "catalogs"."status_light_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition_state_history" ADD CONSTRAINT "requisition_state_history_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "catalogs"."status_change_reason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand"."requisition_state_history" ADD CONSTRAINT "requisition_state_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Restricciones que Prisma no expresa. Referencia: pagina 3 de
-- "Hotel/Demanda - Modelo de Datos.drawio".
-- ============================================================================

-- 3. El numero de renglon es unico dentro de su requisicion. PARCIAL porque la
--    requisicion usa borrado logico: un UNIQUE normal impediria reusar el
--    renglon 2 despues de eliminar esa posicion (seccion 4).
CREATE UNIQUE INDEX ux_position_requisition_line
  ON "demand"."position" (requisition_id, line_number)
  WHERE deleted_at IS NULL;

-- 4. Coherencia dentro de la propia fila.
ALTER TABLE "demand"."requisition"
  ADD CONSTRAINT ck_requisition_authorized_completo
    CHECK ((authorized_by IS NULL AND authorized_at IS NULL)
        OR (authorized_by IS NOT NULL AND authorized_at IS NOT NULL));

ALTER TABLE "demand"."position"
  ADD CONSTRAINT ck_position_quantity_positiva
    CHECK (quantity > 0);

-- Lista cerrada y tecnica: el negocio no agrega estados de ocupacion (seccion 5).
ALTER TABLE "demand"."slot"
  ADD CONSTRAINT ck_slot_status
    CHECK (status IN ('free', 'taken'));

-- 5. EL indice del Self-Pick. Parcial a proposito: solo los libres se buscan,
--    y son los menos.
CREATE INDEX ix_slot_position_free
  ON "demand"."slot" (position_id)
  WHERE status = 'free';

-- updated_at lo mantiene el motor (seccion 4).
CREATE TRIGGER tg_catalog_position_updated_at BEFORE UPDATE ON "catalogs"."position"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_hiring_modality_updated_at BEFORE UPDATE ON "catalogs"."hiring_modality"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_english_level_updated_at BEFORE UPDATE ON "catalogs"."english_level"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_requisition_updated_at BEFORE UPDATE ON "demand"."requisition"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_demand_position_updated_at BEFORE UPDATE ON "demand"."position"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_slot_updated_at BEFORE UPDATE ON "demand"."slot"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE "demand"."slot"
  IS 'RR-15 y D-02: la unidad de bloqueo. SELECT ... FOR UPDATE SKIP LOCKED sobre esta fila es lo que hace innecesario Redis.';
COMMENT ON COLUMN "demand"."slot".ordinal
  IS 'El ORDER BY del Self-Pick lo usa para que los slots se ocupen en orden determinista.';
COMMENT ON COLUMN "demand"."position".hotel_department_id
  IS 'El departamento de la posicion SOLICITADA. No se deriva del catalogo: el hotel puede pedir un Housekeeper para Alimentos.';
COMMENT ON COLUMN "demand"."position".start_time
  IS 'Solo la hora de entrada. La duracion del turno se decide al disenar operations.';
COMMENT ON COLUMN "demand"."requisition".area_manager_user_id
  IS 'El GH responsable. Puede NO ser quien autoriza. Pendiente de confirmar con el negocio.';
COMMENT ON COLUMN "demand"."requisition".deleted_at
  IS 'Borrado logico: el estado Morado del Semaforo de Requisicion lo exige, porque una fila borrada fisicamente no puede tener estado.';
