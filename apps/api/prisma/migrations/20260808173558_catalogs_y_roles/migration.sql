-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalogs";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateTable
CREATE TABLE "catalogs"."status_light" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "status_light_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."status_light_state" (
    "id" UUID NOT NULL,
    "status_light_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "display_order" INTEGER NOT NULL,
    "is_branch" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "status_light_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."status_light_transition" (
    "id" UUID NOT NULL,
    "from_state_id" UUID NOT NULL,
    "to_state_id" UUID NOT NULL,
    "authorized_role_id" UUID NOT NULL,
    "requires_reason" BOOLEAN NOT NULL DEFAULT false,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "status_light_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."status_change_reason" (
    "id" UUID NOT NULL,
    "status_light_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "status_change_reason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."zone" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs"."hotel_department" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "hotel_department_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "catalogs"."hiring_modality" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "hiring_modality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "status_light_code_key" ON "catalogs"."status_light"("code");

-- CreateIndex
CREATE INDEX "ix_status_light_state_light" ON "catalogs"."status_light_state"("status_light_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_status_light_state_light_code" ON "catalogs"."status_light_state"("status_light_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ux_status_light_state_id_light" ON "catalogs"."status_light_state"("id", "status_light_id");

-- CreateIndex
CREATE INDEX "ix_status_light_transition_from" ON "catalogs"."status_light_transition"("from_state_id");

-- CreateIndex
CREATE INDEX "ix_status_light_transition_to" ON "catalogs"."status_light_transition"("to_state_id");

-- CreateIndex
CREATE INDEX "ix_status_light_transition_role" ON "catalogs"."status_light_transition"("authorized_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_status_light_transition_paso" ON "catalogs"."status_light_transition"("from_state_id", "to_state_id", "authorized_role_id");

-- CreateIndex
CREATE INDEX "ix_status_change_reason_light" ON "catalogs"."status_change_reason"("status_light_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_status_change_reason_light_code" ON "catalogs"."status_change_reason"("status_light_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "zone_code_key" ON "catalogs"."zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_department_code_key" ON "catalogs"."hotel_department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "position_code_key" ON "catalogs"."position"("code");

-- CreateIndex
CREATE INDEX "ix_position_hotel_department" ON "catalogs"."position"("hotel_department_id");

-- CreateIndex
CREATE UNIQUE INDEX "english_level_code_key" ON "catalogs"."english_level"("code");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_modality_code_key" ON "catalogs"."hiring_modality"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "identity"."role"("code");

-- AddForeignKey
ALTER TABLE "catalogs"."status_light_state" ADD CONSTRAINT "status_light_state_status_light_id_fkey" FOREIGN KEY ("status_light_id") REFERENCES "catalogs"."status_light"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogs"."status_light_transition" ADD CONSTRAINT "status_light_transition_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "catalogs"."status_light_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogs"."status_light_transition" ADD CONSTRAINT "status_light_transition_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "catalogs"."status_light_state"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogs"."status_light_transition" ADD CONSTRAINT "status_light_transition_authorized_role_id_fkey" FOREIGN KEY ("authorized_role_id") REFERENCES "identity"."role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogs"."status_change_reason" ADD CONSTRAINT "status_change_reason_status_light_id_fkey" FOREIGN KEY ("status_light_id") REFERENCES "catalogs"."status_light"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogs"."position" ADD CONSTRAINT "position_hotel_department_id_fkey" FOREIGN KEY ("hotel_department_id") REFERENCES "catalogs"."hotel_department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- updated_at lo mantiene la BASE, no la aplicación (Estándares de BD §4).
-- Escrito a mano: Prisma no genera triggers.
--
-- La función vive en `public` a propósito. La §1 pide que public quede vacío
-- "salvo extensiones", y esto es una utilidad transversal que los diez esquemas
-- comparten: duplicarla diez veces sería peor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at()
  IS 'Estandares de Base de Datos §4: updated_at lo mantiene el motor.';

CREATE TRIGGER tg_status_light_updated_at BEFORE UPDATE ON "catalogs"."status_light"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_status_light_state_updated_at BEFORE UPDATE ON "catalogs"."status_light_state"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_status_light_transition_updated_at BEFORE UPDATE ON "catalogs"."status_light_transition"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_status_change_reason_updated_at BEFORE UPDATE ON "catalogs"."status_change_reason"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_zone_updated_at BEFORE UPDATE ON "catalogs"."zone"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_hotel_department_updated_at BEFORE UPDATE ON "catalogs"."hotel_department"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_position_updated_at BEFORE UPDATE ON "catalogs"."position"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_english_level_updated_at BEFORE UPDATE ON "catalogs"."english_level"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_hiring_modality_updated_at BEFORE UPDATE ON "catalogs"."hiring_modality"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_role_updated_at BEFORE UPDATE ON "identity"."role"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
