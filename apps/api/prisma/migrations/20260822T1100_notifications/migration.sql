-- El esquema notifications: quien debe enterarse de que. El ultimo de los once.
--
-- Fuente: `_Globales/Notificaciones - Modelo de Datos.drawio` y el
-- `Catalogo de Notificaciones` del vault. Canal: solo push (D-05, FCM).

-- El tipo es CATALOGO y no text + CHECK, y eso se desvia del criterio de
-- Estandares de BD seccion 5 —catalogo solo si el negocio agrega valores—.
-- Aqui los agrega el PRODUCTO. La razon es otra: son mas de cincuenta y crecen
-- con cada feature, y un CHECK obligaria a una migracion por cada aviso nuevo.
CREATE TABLE catalogs.notification_type (
  id          uuid PRIMARY KEY,
  code        text NOT NULL,
  name        text NOT NULL,
  description text,
  module      text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6)
);

CREATE UNIQUE INDEX ux_notification_type_code ON catalogs.notification_type (code);
CREATE INDEX ix_notification_type_module ON catalogs.notification_type (module);

-- UNA FILA POR DESTINATARIO, no una con lista de destinatarios. El vault dice
-- "notifica simultaneamente al Supervisor e Inspector": un evento, dos
-- personas, y cada quien la lee en su momento.
CREATE TABLE notifications.notification (
  id                   uuid PRIMARY KEY,
  user_id              uuid NOT NULL REFERENCES identity."user" (id) ON DELETE RESTRICT,
  notification_type_id uuid NOT NULL REFERENCES catalogs.notification_type (id) ON DELETE RESTRICT,

  title text NOT NULL,
  body  text NOT NULL,

  -- Polimorfico y SIN llave foranea, igual que el journal: con ON DELETE
  -- CASCADE, borrar una requisicion borraria los avisos que ya recibio la
  -- gente.
  entity_type text,
  entity_id   uuid,

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  pushed_at  timestamptz(6),
  push_error text,
  read_at    timestamptz(6),

  -- Si hubo error, hubo intento.
  CONSTRAINT ck_notification_push CHECK (push_error IS NULL OR pushed_at IS NOT NULL),
  -- Atrapa el reloj mal puesto y el dato migrado a mano.
  CONSTRAINT ck_notification_read CHECK (read_at IS NULL OR read_at >= created_at),
  -- La entidad va completa o no va.
  CONSTRAINT ck_notification_entity CHECK (
    (entity_type IS NULL) = (entity_id IS NULL))
);

-- La idempotencia. Pub/Sub entrega AL MENOS UNA VEZ, asi que el mismo evento
-- puede llegar dos veces; sin este unico el reintento manda dos push identicos
-- a la misma persona. Es PARCIAL porque hay avisos genericos sin entidad, y
-- esos si pueden repetirse.
CREATE UNIQUE INDEX ux_notification_event
  ON notifications.notification (user_id, notification_type_id, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- RF-C-09 pide la lista por fecha descendente y un BADGE con el contador de no
-- leidas. El badge se consulta en cada apertura de la app, asi que el indice es
-- parcial sobre las no leidas —que son pocas— en vez de recorrer el historial.
CREATE INDEX ix_notification_user_unread
  ON notifications.notification (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX ix_notification_user_created
  ON notifications.notification (user_id, created_at DESC);

-- Lo que barre el job de retencion: leidas a los 30 dias.
CREATE INDEX ix_notification_read_at
  ON notifications.notification (read_at)
  WHERE read_at IS NOT NULL;

-- Una persona puede tener VARIOS dispositivos: el telefono y la laptop. Por eso
-- es tabla y no una columna en identity.user.
CREATE TABLE notifications.device (
  id       uuid PRIMARY KEY,
  user_id  uuid NOT NULL REFERENCES identity."user" (id) ON DELETE RESTRICT,

  fcm_token text NOT NULL,
  platform  text NOT NULL,

  last_seen_at timestamptz(6),
  revoked_at   timestamptz(6),
  created_at   timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT ck_device_platform CHECK (platform IN ('WEB', 'ANDROID', 'IOS'))
);

-- Si dos usuarios comparten token, uno recibe los push del otro — y en un
-- telefono prestado eso es justo lo que pasa al cambiar de sesion sin revocar.
-- Es PARCIAL porque el token rota: el viejo se revoca y el mismo valor puede
-- volver a asignarse despues.
CREATE UNIQUE INDEX ux_device_token
  ON notifications.device (fcm_token)
  WHERE revoked_at IS NULL;

CREATE INDEX ix_device_user_active
  ON notifications.device (user_id)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA notifications TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON catalogs.notification_type TO app_user;
