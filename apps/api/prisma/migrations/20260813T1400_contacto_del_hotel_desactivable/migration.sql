-- Un contacto del hotel se puede dar de baja sin borrarlo.
--
-- `contact_attempt` apunta a `hotel_contact` con ON DELETE RESTRICT, asi que un
-- contacto con intentos registrados NO se puede eliminar: borrarlo dejaria esos
-- intentos sin decir a quien se llamo. Pero la gente cambia de trabajo, y hasta
-- hoy la unica salida era dejarlo en la lista para siempre.

ALTER TABLE "commercial"."hotel_contact"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- El principal ahora es "un solo principal ACTIVO por hotel".
--
-- Sin esto, dar de baja al contacto principal deja el lugar ocupado por alguien
-- que ya no trabaja ahi: el indice viejo lo sigue contando y rechaza al nuevo
-- principal. La regla que el negocio quiere es sobre los vigentes.
-- ---------------------------------------------------------------------------

DROP INDEX "commercial"."ux_hotel_contact_primary";

CREATE UNIQUE INDEX "ux_hotel_contact_primary"
  ON "commercial"."hotel_contact" (hotel_id)
  WHERE is_primary AND is_active;

COMMENT ON COLUMN "commercial"."hotel_contact"."is_active"
  IS 'Falso = ya no trabaja en el hotel. No se borra porque contact_attempt lo referencia con ON DELETE RESTRICT.';
