-- El ponche gana un segundo metodo, decidido POR HOTEL (Reglas de Negocio,
-- "Metodo de ponche por hotel", autorizado el 2026-09-07): algunos hoteles no
-- permiten tomar selfies. La Selfie sigue siendo el metodo por defecto; con
-- QR el hotel imprime un codigo secreto en el acceso y la app lo escanea.
--
-- Es un dato del hotel y no de la requisicion: la politica "aqui no se toman
-- fotos" es del edificio y aplica a todo lo que se poncha en el.
--
-- El secreto NUNCA sale por el API tal cual: viaja dentro del payload del QR
-- (que se imprime) y se compara al ponchar. La version existe para REGENERAR:
-- un QR impreso acaba fotografiado, y regenerarlo invalida el anterior al
-- instante sin tocar ninguna marca ya registrada.
ALTER TABLE commercial.hotel
  ADD COLUMN punch_method          text NOT NULL DEFAULT 'SELFIE',
  ADD COLUMN punch_qr_secret       text,
  ADD COLUMN punch_qr_version      integer NOT NULL DEFAULT 0,
  ADD COLUMN punch_qr_generated_at timestamptz(6);

-- Dos valores fijos y ninguna pantalla donde el negocio agregue otro:
-- text + CHECK, no catalogo (Estandares de BD, seccion 5).
ALTER TABLE commercial.hotel
  ADD CONSTRAINT ck_hotel_punch_method CHECK (punch_method IN ('SELFIE', 'QR'));

-- Con QR, la marca guarda QUE version del codigo se escaneo, no el secreto:
-- es la evidencia equivalente a photo_path, y sobrevive a que el hotel
-- regenere su codigo despues.
ALTER TABLE operations.punch_mark ADD COLUMN qr_version integer;

-- La evidencia de Entrada y Salida ya no es solo la foto: con QR es la
-- version del codigo escaneado. La restriccion que exigia foto pasa a exigir
-- UNA de las dos (o que la marca sea manual, que no lleva ninguna).
ALTER TABLE operations.punch_mark DROP CONSTRAINT ck_punch_photo;
ALTER TABLE operations.punch_mark
  ADD CONSTRAINT ck_punch_evidence CHECK (
    type IN ('LUNCH_OUT', 'LUNCH_IN')
    OR is_manual = true
    OR photo_path IS NOT NULL
    OR qr_version IS NOT NULL
  );
