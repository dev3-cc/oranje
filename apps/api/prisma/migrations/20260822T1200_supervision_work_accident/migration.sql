-- La tarjeta de accidente: la PRIMERA tabla del esquema supervision, que
-- existia vacio desde la migracion de los esquemas.
--
-- Fuente: `_Globales/Accidente Laboral - Modelo de Datos.drawio`.
--
-- No crea catalogo: el status es lista cerrada y tecnica —nadie del negocio
-- agrega estados sin un despliegue—, asi que va como text + CHECK.
--
-- Tampoco crea tabla de historia propia: el timeline de status va al journal
-- por mandato del vault, y D-14 aplica a semaforos — el status de la tarjeta
-- no lo es.
CREATE TABLE supervision.work_accident (
  id     uuid PRIMARY KEY,
  number text NOT NULL,

  hotel_id            uuid NOT NULL REFERENCES commercial.hotel (id) ON DELETE RESTRICT,
  worker_id           uuid NOT NULL REFERENCES personal.worker (id) ON DELETE RESTRICT,
  reported_by_user_id uuid NOT NULL REFERENCES identity."user" (id) ON DELETE RESTRICT,
  -- Derivable de la zona del hotel (RR-13), pero se CONGELA al crear: el
  -- Coordinador puede reasignar la zona manana y la tarjeta debe conservar
  -- quien la atendio. Mismo patron que requisition.inspector_id.
  inspector_id uuid REFERENCES identity."user" (id) ON DELETE RESTRICT,

  occurred_at timestamptz(6) NOT NULL,
  status      text NOT NULL DEFAULT 'REPORTED',

  -- Presencial, lo captura el Supervisor.
  site_location       text,
  circumstances       text,
  witnesses           text,
  immediate_care      text,
  on_site_captured_by uuid REFERENCES identity."user" (id) ON DELETE RESTRICT,
  on_site_captured_at timestamptz(6),

  -- Seguimiento medico, lo captura el Inspector. is_transferred es NULABLE a
  -- proposito: NULL es "aun no se captura", que no es lo mismo que FALSE.
  is_transferred  boolean,
  medical_center  text,
  diagnosis       text,
  disability_days integer,
  medical_notes   text,

  medical_discharge_date date,
  closed_by uuid REFERENCES identity."user" (id) ON DELETE RESTRICT,
  closed_at timestamptz(6),

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6),
  created_by uuid NOT NULL REFERENCES identity."user" (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES identity."user" (id) ON DELETE RESTRICT,

  -- Los CUATRO codigos son PROPUESTA derivada de las fases del flujo: el vault
  -- dice que la tarjeta tiene status pero nunca los nombra.
  CONSTRAINT ck_work_accident_status CHECK (
    status IN ('REPORTED', 'ON_SITE_CAPTURED', 'MEDICAL_FOLLOW_UP', 'CLOSED')),

  -- La captura presencial es un acto de una persona en un momento.
  CONSTRAINT ck_work_accident_on_site_complete CHECK (
    (on_site_captured_by IS NULL) = (on_site_captured_at IS NULL)),
  CONSTRAINT ck_work_accident_closed_complete CHECK (
    (closed_by IS NULL) = (closed_at IS NULL)),

  -- Reglas de Negocio: Gris -> Verde fuerte exige alta medica y cierre por el
  -- Inspector.
  CONSTRAINT ck_work_accident_close_requires_discharge CHECK (
    status <> 'CLOSED'
    OR (closed_at IS NOT NULL AND medical_discharge_date IS NOT NULL)),

  -- El centro solo existe si hubo traslado.
  CONSTRAINT ck_work_accident_transfer_coherent CHECK (
    is_transferred IS NOT FALSE OR medical_center IS NULL),

  CONSTRAINT ck_work_accident_disability_days CHECK (disability_days >= 0)
);

-- Mismo patron que la Requisicion: AAAAMMDDHHMM + homoclave. No es parcial
-- porque la tarjeta no se borra: el registro de un hecho con posible
-- consecuencia legal no se borra ni logica ni fisicamente.
CREATE UNIQUE INDEX ux_work_accident_number ON supervision.work_accident (number);

CREATE INDEX ix_work_accident_worker ON supervision.work_accident (worker_id);
CREATE INDEX ix_work_accident_hotel  ON supervision.work_accident (hotel_id);

-- LA bandeja del Inspector: sus tarjetas pendientes. Parcial a proposito,
-- porque las abiertas son las menos.
CREATE INDEX ix_work_accident_inspector_open
  ON supervision.work_accident (inspector_id)
  WHERE status <> 'CLOSED';

-- FK indexadas por regla; Postgres no lo hace solo.
CREATE INDEX ix_work_accident_reported_by ON supervision.work_accident (reported_by_user_id);
CREATE INDEX ix_work_accident_on_site_captured_by
  ON supervision.work_accident (on_site_captured_by);
CREATE INDEX ix_work_accident_closed_by ON supervision.work_accident (closed_by);

GRANT SELECT, INSERT, UPDATE ON supervision.work_accident TO app_user;
