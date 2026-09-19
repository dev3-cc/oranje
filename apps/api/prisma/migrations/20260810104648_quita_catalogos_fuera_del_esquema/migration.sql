-- ============================================================================
-- Quita tres catalogos que NO estan en "Ventas - Modelo de Datos v2.drawio".
--
-- Los habia creado derivandolos del vault en vez del diagrama, y ninguna FK les
-- apuntaba: tablas vacias que hacian que el esquema real dejara de coincidir con
-- el documento que el equipo revisa.
--
--   english_level    -> del Colaborador (Reclutamiento)
--   hiring_modality  -> de la Requisicion
--   position         -> de la Requisicion y del Colaborador
--
-- Vuelven cuando su departamento entre, con su diagrama.
-- `hotel_department` se queda: identity.user.department_id le apunta.
-- ============================================================================

-- DropForeignKey
ALTER TABLE "catalogs"."position" DROP CONSTRAINT "position_hotel_department_id_fkey";

-- DropTable
DROP TABLE "catalogs"."english_level";

-- DropTable
DROP TABLE "catalogs"."hiring_modality";

-- DropTable
DROP TABLE "catalogs"."position";

