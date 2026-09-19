-- La foto del hotel, según Google Places (el front la captura al autollenar).
-- Nulable: los hoteles previos no la tienen y el negocio no la exige.
ALTER TABLE commercial.hotel ADD COLUMN photo_url text;
