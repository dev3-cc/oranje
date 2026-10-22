-- Candado del contrato ACTIVO (Hugo, 2026-10-21): mismo criterio que
-- Blacklist, no el del Timesheet — ahí el candado es decorativo y no hay
-- vuelta atrás; aquí sí la hay, con motivo y en el journal. `is_unlocked`
-- es lo único que se guarda: "bloqueado" se calcula (status = ACTIVE y
-- is_unlocked = false), nunca se vuelve a tocar el status por esto.
ALTER TABLE commercial.contract ADD COLUMN is_unlocked boolean NOT NULL DEFAULT false;
