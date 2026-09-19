-- photo_url pasa a photo_ref, y las URLs muertas se limpian.
--
-- Lo que se guardaba era la URL de `PhotoService.GetPhoto`, que devuelve el
-- getUrl() del SDK de Places en el navegador: lleva un token de SESION efimero.
-- Verificado contra dev: las seis responden 403.
--
-- Es el mismo error que photo_path del Colaborador — persistir una credencial
-- vencida en vez de una referencia estable— pero al reves: alla el bucket es
-- nuestro y la ruta es estable; aqui el binario es de Google y lo estable es el
-- RESOURCE NAME de la foto (`places/{id}/photos/{ref}`).
--
-- photo_ref_at existe por la POLITICA de Google, no por rendimiento: el
-- place_id se puede guardar indefinidamente, pero el resto del contenido de
-- Places solo 30 dias. La marca de tiempo es lo que permite refrescar la
-- referencia antes de que caduque ese permiso.
ALTER TABLE commercial.hotel RENAME COLUMN photo_url TO photo_ref;
ALTER TABLE commercial.hotel ADD COLUMN photo_ref_at timestamptz(6);

-- Ninguna sirve: son tokens de sesion del navegador, no referencias.
UPDATE commercial.hotel
   SET photo_ref = NULL
 WHERE photo_ref IS NOT NULL;
