-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "personal";

-- AlterTable
ALTER TABLE "identity"."user" ADD COLUMN     "firebase_uid" TEXT;

-- CreateTable
CREATE TABLE "personal"."worker" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "full_name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "zone_id" UUID NOT NULL,
    "ssn_encrypted" BYTEA,
    "itin_encrypted" BYTEA,
    "catalog_position_id" UUID,
    "english_level_id" UUID,
    "hiring_modality_id" UUID,
    "experience_level" TEXT,
    "transport_type" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relationship" TEXT,
    "blood_type" TEXT,
    "medical_notes" TEXT,
    "status_light_state_id" UUID NOT NULL,
    "status_light_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,

    CONSTRAINT "worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal"."worker_document" (
    "id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal"."worker_state_history" (
    "id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "from_state_id" UUID,
    "to_state_id" UUID NOT NULL,
    "status_light_id" UUID NOT NULL,
    "reason_id" UUID,
    "user_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage"."assignment" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "validity" daterange NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assigned_by" UUID NOT NULL,
    "closed_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage"."participation" (
    "id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),

    CONSTRAINT "participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage"."blacklist_entry" (
    "id" UUID NOT NULL,
    "worker_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_path" TEXT,
    "entered_by" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ux_worker_user" ON "personal"."worker"("user_id");

-- CreateIndex
CREATE INDEX "ix_worker_state" ON "personal"."worker"("status_light_state_id");

-- CreateIndex
CREATE INDEX "ix_worker_zone" ON "personal"."worker"("zone_id");

-- CreateIndex
CREATE INDEX "ix_worker_position" ON "personal"."worker"("catalog_position_id");

-- CreateIndex
CREATE INDEX "ix_worker_document_worker" ON "personal"."worker_document"("worker_id");

-- CreateIndex
CREATE INDEX "ix_worker_state_history_worker" ON "personal"."worker_state_history"("worker_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_assignment_worker" ON "coverage"."assignment"("worker_id");

-- CreateIndex
CREATE INDEX "ix_assignment_slot" ON "coverage"."assignment"("slot_id");

-- CreateIndex
CREATE INDEX "ix_participation_requisition" ON "coverage"."participation"("requisition_id");

-- CreateIndex
CREATE INDEX "ix_participation_user" ON "coverage"."participation"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_blacklist_worker" ON "coverage"."blacklist_entry"("worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_firebase_uid_key" ON "identity"."user"("firebase_uid");

-- AddForeignKey
ALTER TABLE "personal"."worker" ADD CONSTRAINT "worker_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker" ADD CONSTRAINT "worker_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker" ADD CONSTRAINT "worker_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "catalogs"."zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker" ADD CONSTRAINT "worker_catalog_position_id_fkey" FOREIGN KEY ("catalog_position_id") REFERENCES "catalogs"."position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker" ADD CONSTRAINT "worker_english_level_id_fkey" FOREIGN KEY ("english_level_id") REFERENCES "catalogs"."english_level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker" ADD CONSTRAINT "worker_hiring_modality_id_fkey" FOREIGN KEY ("hiring_modality_id") REFERENCES "catalogs"."hiring_modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker" ADD CONSTRAINT "worker_status_light_state_id_status_light_id_fkey" FOREIGN KEY ("status_light_state_id", "status_light_id") REFERENCES "catalogs"."status_light_state"("id", "status_light_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_document" ADD CONSTRAINT "worker_document_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_document" ADD CONSTRAINT "worker_document_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_state_history" ADD CONSTRAINT "worker_state_history_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_state_history" ADD CONSTRAINT "worker_state_history_from_state_id_status_light_id_fkey" FOREIGN KEY ("from_state_id", "status_light_id") REFERENCES "catalogs"."status_light_state"("id", "status_light_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_state_history" ADD CONSTRAINT "worker_state_history_to_state_id_status_light_id_fkey" FOREIGN KEY ("to_state_id", "status_light_id") REFERENCES "catalogs"."status_light_state"("id", "status_light_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_state_history" ADD CONSTRAINT "worker_state_history_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "catalogs"."status_change_reason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal"."worker_state_history" ADD CONSTRAINT "worker_state_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage"."assignment" ADD CONSTRAINT "assignment_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "demand"."slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage"."assignment" ADD CONSTRAINT "assignment_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage"."assignment" ADD CONSTRAINT "assignment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage"."participation" ADD CONSTRAINT "participation_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "demand"."requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage"."participation" ADD CONSTRAINT "participation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage"."blacklist_entry" ADD CONSTRAINT "blacklist_entry_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "personal"."worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage"."blacklist_entry" ADD CONSTRAINT "blacklist_entry_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ###########################################################################
-- Lo que Prisma no sabe declarar. Todo esto se escribe a mano.
-- ###########################################################################

-- --- listas cerradas: text + CHECK, no catalogo (seccion 5) ---------------
-- El criterio de la seccion 5 es QUIEN agrega el valor. Estas las fija el
-- producto, no el negocio, asi que no merecen tabla.

ALTER TABLE personal.worker
  ADD CONSTRAINT ck_worker_gender CHECK (
    gender IN ('MALE', 'FEMALE', 'OTHER')),
  ADD CONSTRAINT ck_worker_experience CHECK (
    experience_level IS NULL OR experience_level IN
      ('NONE', 'ONE_TO_TWO', 'THREE_TO_FIVE', 'MORE_THAN_FIVE')),
  ADD CONSTRAINT ck_worker_transport CHECK (
    transport_type IS NULL OR transport_type IN ('OWN', 'PUBLIC', 'OTHER')),
  ADD CONSTRAINT ck_worker_relationship CHECK (
    emergency_contact_relationship IS NULL OR emergency_contact_relationship IN
      ('MOTHER', 'FATHER', 'SPOUSE', 'SIBLING', 'CHILD', 'FRIEND', 'OTHER')),
  -- UNKNOWN es el "No sé" del formulario: un valor legitimo, no un NULL.
  ADD CONSTRAINT ck_worker_blood_type CHECK (
    blood_type IS NULL OR blood_type IN
      ('A_POS','A_NEG','B_POS','B_NEG','AB_POS','AB_NEG','O_POS','O_NEG','UNKNOWN'));

ALTER TABLE personal.worker_document
  ADD CONSTRAINT ck_worker_document_type CHECK (
    document_type IN ('SSN_ITIN', 'ID', 'PROOF_OF_ADDRESS', 'OTHER'));

ALTER TABLE coverage.assignment
  ADD CONSTRAINT ck_assignment_type CHECK (type IN ('FIXED', 'TEMPORARY')),
  ADD CONSTRAINT ck_assignment_status CHECK (
    status IN ('ACTIVE', 'CLOSED', 'CANCELLED'));

ALTER TABLE coverage.blacklist_entry
  ADD CONSTRAINT ck_blacklist_source CHECK (
    source IN ('MANUAL', 'ABSENCES', 'DISPUTE'));

-- --- el temporal lleva fin; el fijo, no ----------------------------------
-- El vault dice que la asignacion temporal define sus dias al asignar y se
-- cierra sola al vencer. La fija no tiene fin: termina cuando el hotel manda al
-- colaborador a descansar (Rosa). Sin este CHECK, un temporal sin fin nunca se
-- cerraria.
ALTER TABLE coverage.assignment
  ADD CONSTRAINT ck_assignment_validity CHECK (
    (type = 'TEMPORARY' AND upper_inf(validity) = false)
    OR
    (type = 'FIXED' AND upper_inf(validity) = true));

-- --- motivo y evidencia en el veto manual --------------------------------
-- Blacklist.md: la falta grave manual exige motivo Y evidencia. El automatico
-- por inasistencias y el de disputa no traen archivo, su respaldo es el
-- historial.
ALTER TABLE coverage.blacklist_entry
  ADD CONSTRAINT ck_blacklist_evidence CHECK (
    source <> 'MANUAL' OR evidence_path IS NOT NULL);

-- --- las dos columnas derivadas -----------------------------------------
-- GENERATED y no calculadas por la aplicacion: Postgres las recalcula en cada
-- escritura, asi que no pueden quedar desincronizadas.

-- Sin SSN ni ITIN se activa la retencion del 16% (reembolsable).
ALTER TABLE personal.worker
  ADD COLUMN has_tax_id boolean
  GENERATED ALWAYS AS (
    ssn_encrypted IS NOT NULL OR itin_encrypted IS NOT NULL
  ) STORED;

-- Los 8 campos que 10 - Validaciones marca obligatorios. No pueden ser NOT NULL
-- porque los datos llegan en TRES fases y entre una y otra la fila existe a
-- medias — eso ES el estado Blanco. Esta columna es lo que lee el guard de la
-- transicion Blanco -> Verde fuerte: la Reclutadora no valida un perfil a medias.
ALTER TABLE personal.worker
  ADD COLUMN is_profile_complete boolean
  GENERATED ALWAYS AS (
    catalog_position_id            IS NOT NULL AND
    english_level_id               IS NOT NULL AND
    hiring_modality_id             IS NOT NULL AND
    experience_level               IS NOT NULL AND
    transport_type                 IS NOT NULL AND
    emergency_contact_name         IS NOT NULL AND
    emergency_contact_phone        IS NOT NULL AND
    emergency_contact_relationship IS NOT NULL AND
    blood_type                     IS NOT NULL
  ) STORED;

-- --- un slot, una sola asignacion activa --------------------------------
-- ESTA es la restriccion que de verdad muerde: impide que dos colaboradores
-- ocupen la misma plaza. El nombre ya venia escrito en la seccion 2 de los
-- Estandares de Base de Datos.
--
-- Es PARCIAL a proposito. Un unique simple sobre slot_id prohibiria reusar el
-- slot despues de cerrar la asignacion, y el slot se tiene que poder volver a
-- ocupar.
--
-- ATENCION: Prisma no sabe declarar indices parciales, asi que este indice NO
-- esta en el datamodel y el proximo `migrate diff` lo va a proponer para DROP.
-- Es exactamente lo que se comio el indice espacial de la geocerca el
-- 2026-08-08. Lo que lo protege es el test de la Fase 4 que intenta insertar dos
-- asignaciones activas sobre el mismo slot y espera el error del motor: si
-- alguien borra el indice, ese test truena.
CREATE UNIQUE INDEX ux_slot_active_assignment
  ON coverage.assignment (slot_id)
  WHERE status = 'ACTIVE';

-- El Pool solo mira a los no borrados y filtra por estado.
CREATE INDEX ix_worker_pool
  ON personal.worker (status_light_state_id, zone_id, catalog_position_id)
  WHERE deleted_at IS NULL;

-- --- updated_at lo mantiene la base, no la aplicacion (seccion 4) -------
CREATE TRIGGER tg_worker_updated_at BEFORE UPDATE ON personal.worker
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_assignment_updated_at BEFORE UPDATE ON coverage.assignment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
