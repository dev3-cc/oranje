-- El registro de lo que sale por correo.
--
-- Hasta hoy el API no mandaba un solo correo propio: lo unico que salia era
-- el `sendPasswordReset` de Firebase, cuya plantilla no se puede modificar
-- (Hugo, 2026-09-25). Con el mailer propio el correo pasa a ser nuestro, y
-- lo que se manda deja rastro aqui — sin esta tabla, "salio bien pero no
-- llego" no se puede ni empezar a investigar.
--
-- `transport` dice POR DONDE salio, no como se pidio: cuando el SMTP falla,
-- el servicio cae solo a Firebase y la fila lo delata. Asi se ve de un
-- vistazo cuantos correos salieron por el respaldo y en que horas.
--
-- Sin tabla de historia ni journal: una fila es un hecho consumado que no se
-- corrige, igual que una auditoria. Lo unico que cambia despues es el
-- desenlace (rebote), y eso llega en otro PR.

CREATE TABLE notifications.email_delivery (
  id uuid PRIMARY KEY,

  -- La plantilla, no el asunto: el asunto cambia con el idioma y con los
  -- datos, la plantilla es la que identifica al correo.
  template text NOT NULL,
  subject  text NOT NULL,
  locale   text NOT NULL,

  -- La direccion va SIEMPRE; el usuario solo si el correo es de alguien con
  -- cuenta (un prospecto o un contacto de hotel no la tiene).
  to_email   text NOT NULL,
  -- SET NULL y no RESTRICT: el registro de un correo enviado no puede impedir
  -- que se borre una cuenta, y lo que de verdad identifica al envio es la
  -- direccion, que siempre queda. El vinculo es una comodidad para mirar
  -- "que le hemos mandado a esta persona", no la columna que sostiene la fila.
  to_user_id uuid REFERENCES identity."user" (id) ON DELETE SET NULL,

  transport text NOT NULL,
  status    text NOT NULL,
  -- Cuantos intentos costo. 1 = salio al primero.
  attempts  integer NOT NULL DEFAULT 1,

  -- Lo que devolvio el servidor: con el message id se rastrea el correo en
  -- los logs del proveedor y se casa con su rebote.
  message_id text,
  error      text,

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  sent_at    timestamptz(6),

  CONSTRAINT ck_email_delivery_locale CHECK (locale IN ('es', 'en')),
  CONSTRAINT ck_email_delivery_transport CHECK (transport IN ('SMTP', 'FIREBASE')),
  CONSTRAINT ck_email_delivery_status CHECK (status IN ('SENT', 'FAILED')),
  -- Un envio exitoso tiene hora; uno fallido, no. Y al reves.
  CONSTRAINT ck_email_delivery_sent_at CHECK ((status = 'SENT') = (sent_at IS NOT NULL)),
  CONSTRAINT ck_email_delivery_attempts CHECK (attempts >= 1)
);

-- Las dos preguntas que se hacen de verdad: "que le hemos mandado a esta
-- persona" y "que fallo hoy".
CREATE INDEX ix_email_delivery_to ON notifications.email_delivery (to_email, created_at DESC);
CREATE INDEX ix_email_delivery_failed ON notifications.email_delivery (created_at DESC)
  WHERE status = 'FAILED';

GRANT SELECT, INSERT ON notifications.email_delivery TO app_user;
