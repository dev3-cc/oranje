-- Quien disparo el evento con su accion (Hugo, 2026-09-15): nulo en avisos
-- sin actor humano (SYSTEM). A diferencia de entity_type/entity_id (sin FK,
-- igual que journal, para no bloquear borrar la entidad), este SI lleva llave
-- foranea porque apunta a identity.user, que nunca se borra de verdad -- solo
-- se desactiva -- asi que no hay nada que proteger dejandolo suelto.

ALTER TABLE notifications.notification ADD COLUMN actor_user_id uuid;

ALTER TABLE notifications.notification
  ADD CONSTRAINT notification_actor_user_id_fkey FOREIGN KEY (actor_user_id)
  REFERENCES identity."user" (id) ON UPDATE CASCADE ON DELETE RESTRICT;
