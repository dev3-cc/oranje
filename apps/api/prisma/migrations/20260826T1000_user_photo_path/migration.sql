-- Los usuarios del sistema llevan foto, con el mismo patrón D-30 del worker:
-- el bucket es privado y lo que persiste es la RUTA del objeto
-- (users/photo/...); la URL firmada caduca en una hora y se firma al leer.
-- Guardarla sería guardar una credencial vencida.

ALTER TABLE identity."user" ADD COLUMN photo_path text;
