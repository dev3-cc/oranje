-- Los ajustes del sistema, que hasta hoy no tenian donde vivir.
--
-- Nace por el freno de mano del correo (Hugo, 2026-09-25): el respaldo
-- automatico se dispara cuando el SMTP FALLA, pero no cuando acepta el correo
-- y no lo entrega — que es justo lo que hace un hosting compartido cuando nos
-- limita. En ese caso alguien tiene que poder forzar el respaldo, y hacerlo
-- SIN un despliegue: una variable de entorno obliga a una revision nueva de
-- Cloud Run, y eso no es un interruptor, es un deploy.
--
-- Va en `catalogs` porque es lo que el Administrador edita desde la app, como
-- el resto de este esquema; un esquema nuevo por una sola tabla seria peor.
--
-- Clave-valor a proposito: los ajustes son pocos y de tipos distintos, y una
-- columna por ajuste obliga a una migracion cada vez que aparece uno. Lo que
-- evita que el valor sea cualquier cosa es el CHECK de abajo, por clave.

CREATE TABLE catalogs.app_setting (
  key   text PRIMARY KEY,
  value text NOT NULL,

  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  -- Quien lo movio. SET NULL y no RESTRICT: un ajuste no puede impedir que se
  -- borre una cuenta, y el journal guarda el rastro completo de todos modos.
  updated_by uuid REFERENCES identity."user" (id) ON DELETE SET NULL,

  -- El valor se valida por clave, aqui y no solo en el servicio: es lo que
  -- impide que un UPDATE a mano deje el correo en un estado que el codigo no
  -- sabe leer.
  CONSTRAINT ck_app_setting_value CHECK (
    CASE key
      WHEN 'mail.transport' THEN value IN ('own', 'firebase')
      ELSE true
    END
  )
);

-- El unico ajuste de hoy, con el valor que ya tenia por defecto en el codigo:
-- sembrarlo aqui hace que la pantalla del Administrador tenga algo que
-- mostrar desde el primer arranque, en vez de una fila fantasma.
INSERT INTO catalogs.app_setting (key, value) VALUES ('mail.transport', 'own');

GRANT SELECT, INSERT, UPDATE ON catalogs.app_setting TO app_user;
