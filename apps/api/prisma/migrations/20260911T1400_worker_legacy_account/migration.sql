-- Migracion de correo: el lunes arranca gente que hoy solo conoce su correo
-- viejo (de otro sistema). Se le crea tambien la cuenta corporativa, pero
-- mientras no venza `deprecates_at` puede seguir entrando con la vieja y
-- llegar al MISMO expediente -- por eso worker gana un segundo puntero a
-- identity.user, en paralelo a user_id, no en su lugar.

ALTER TABLE personal.worker ADD COLUMN legacy_user_id uuid;

ALTER TABLE personal.worker
  ADD CONSTRAINT worker_legacy_user_id_fkey FOREIGN KEY (legacy_user_id)
  REFERENCES identity."user" (id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE UNIQUE INDEX ux_worker_legacy_user ON personal.worker (legacy_user_id);

-- Cuando vence, la cuenta deja de poder autenticar (lo aplica el guard de
-- sesion). Null = cuenta normal, sin fecha de vencimiento.
ALTER TABLE identity."user" ADD COLUMN deprecates_at timestamp(6) with time zone;
