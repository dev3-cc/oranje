-- D-36: la interfaz habla el idioma de la persona (espanol por defecto, ingles
-- como segundo idioma). La preferencia vive en la PERSONA, no solo en el
-- navegador: asi la sigue entre dispositivos y sirve para correos y
-- notificaciones. Dos valores fijos y ninguna pantalla donde el negocio agregue
-- otro: text + CHECK, no catalogo (Estandares de BD, seccion 5).
ALTER TABLE identity.user
  ADD COLUMN locale text NOT NULL DEFAULT 'es';

ALTER TABLE identity.user
  ADD CONSTRAINT ck_user_locale CHECK (locale IN ('es', 'en'));
