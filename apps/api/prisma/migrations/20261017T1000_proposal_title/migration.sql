-- La propuesta gana un título corto (Hugo, 2026-10-17): un BD con varios
-- ciclos a la vez necesita distinguirlos de un vistazo sin abrir cada uno.
-- Nullable a propósito: las versiones que ya existen no lo tienen y no se
-- inventa uno; el front lo exige al crear o guardar desde hoy.

ALTER TABLE commercial.proposal
  ADD COLUMN title text;
