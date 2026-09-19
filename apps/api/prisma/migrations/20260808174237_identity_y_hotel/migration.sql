-- ============================================================================
-- Extensiones. Van DENTRO de la migración a propósito: si vivieran solo en un
-- comando manual, el esquema no se podría recrear desde cero — y la shadow
-- database de Prisma, que se crea vacía en cada `migrate dev`, no las tendría.
--
--   postgis    -> commercial.hotel.coordinates y la geocerca del ponche (D-08)
--   pgcrypto   -> cifrado de campo de SSN e ITIN (Estandares de BD §12)
--   btree_gist -> la restriccion de exclusion de RR-05
--
-- En `public`, que por §1 queda vacio salvo extensiones.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "commercial";

-- CreateTable
CREATE TABLE "identity"."role_permission" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role_id" UUID NOT NULL,
    "hotel_id" UUID,
    "department_id" UUID,
    "reports_to_user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."hotel" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "general_phone" TEXT,
    "zone_id" UUID NOT NULL,
    "coordinates" public.geography(Point, 4326),
    "geofence_radius_m" INTEGER,
    "time_zone" TEXT NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "hotel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_role_permission_role" ON "identity"."role_permission"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_role_permission_rol_modulo_accion" ON "identity"."role_permission"("role_id", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "identity"."user"("email");

-- CreateIndex
CREATE INDEX "ix_user_role" ON "identity"."user"("role_id");

-- CreateIndex
CREATE INDEX "ix_user_hotel" ON "identity"."user"("hotel_id");

-- CreateIndex
CREATE INDEX "ix_user_reports_to" ON "identity"."user"("reports_to_user_id");

-- CreateIndex
CREATE INDEX "ix_hotel_zone" ON "commercial"."hotel"("zone_id");

-- AddForeignKey
ALTER TABLE "identity"."role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user" ADD CONSTRAINT "user_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "commercial"."hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user" ADD CONSTRAINT "user_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "catalogs"."hotel_department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user" ADD CONSTRAINT "user_reports_to_user_id_fkey" FOREIGN KEY ("reports_to_user_id") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."hotel" ADD CONSTRAINT "hotel_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "catalogs"."zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."hotel" ADD CONSTRAINT "hotel_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."hotel" ADD CONSTRAINT "hotel_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "identity"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Escrito a mano: Prisma no genera triggers ni CHECK.
-- ============================================================================

CREATE TRIGGER tg_role_permission_updated_at BEFORE UPDATE ON "identity"."role_permission"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_user_updated_at BEFORE UPDATE ON "identity"."user"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_hotel_updated_at BEFORE UPDATE ON "commercial"."hotel"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- No hay departamento sin hotel: el alcance por departamento solo existe dentro
-- de un hotel (Modelo de Datos §9).
ALTER TABLE "identity"."user"
  ADD CONSTRAINT ck_user_department_requiere_hotel
  CHECK (department_id IS NULL OR hotel_id IS NOT NULL);

-- Indice espacial: sin el, ST_DWithin recorre la tabla entera en cada ponche.
CREATE INDEX ix_hotel_coordinates ON "commercial"."hotel" USING gist (coordinates);

COMMENT ON COLUMN "identity"."user".department_id
  IS 'Modelo de Datos §9: NULO = todos los departamentos de mi hotel. Es lo que separa al Manager General del Manager de Area.';
COMMENT ON COLUMN "commercial"."hotel".time_zone
  IS 'Estandares de BD §11: IANA, no offset. Sin esto no hay jornada ni corte semanal deterministas.';
