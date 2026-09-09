-- Las dos auditorias del Supervisor (Presentacion Personal por colaborador,
-- Percepcion de Ambiente y Recursos por hotel): CUATRO tablas, una en
-- catalogs y tres en supervision.
--
-- Fuente: `_Globales/Auditoria de Presentacion y Ambiente - Modelo de Datos.drawio`.
--
-- Cabecera UNICA (audit) para las dos auditorias, discriminada por
-- audit_type: worker_id es NULABLE y solo se exige (CHECK) para
-- PERSONAL_PRESENTATION. Los reactivos son un catalogo editable por el
-- Administrador, con weight (confirmado por Hugo: NO pesan igual). Las
-- respuestas llevan audit_type duplicado a proposito para sostener una FK
-- COMPUESTA que impide, por diseno del motor, que un reactivo de un tipo se
-- cuele como respuesta de una auditoria del otro tipo -- sin trigger.
--
-- Es un registro sin consecuencia: no crea ni toca ningun semaforo.

CREATE TABLE catalogs.audit_checklist_item (
  id uuid PRIMARY KEY,

  audit_type text NOT NULL,
  category   text NOT NULL,
  code       text NOT NULL,
  label      text NOT NULL,
  -- Confirmado por Hugo: los reactivos NO pesan igual. DEFAULT 1 = todos
  -- empiezan iguales, el Administrador los diferencia despues.
  weight     numeric(5,2) NOT NULL DEFAULT 1,
  ordinal    integer NOT NULL,

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6),

  CONSTRAINT ck_checklist_item_audit_type CHECK (
    audit_type IN ('PERSONAL_PRESENTATION', 'ENVIRONMENT')),
  CONSTRAINT ck_checklist_item_weight_positive CHECK (weight > 0)
);

ALTER TABLE catalogs.audit_checklist_item
  ADD CONSTRAINT ux_checklist_item_id_type UNIQUE (id, audit_type);

CREATE UNIQUE INDEX ux_checklist_item_code
  ON catalogs.audit_checklist_item (audit_type, code);

CREATE INDEX ix_checklist_item_render
  ON catalogs.audit_checklist_item (audit_type, category, ordinal);

CREATE TRIGGER tg_audit_checklist_item_updated_at BEFORE UPDATE ON catalogs.audit_checklist_item
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON catalogs.audit_checklist_item TO app_user;


CREATE TABLE supervision.audit (
  id uuid PRIMARY KEY,

  audit_type         text NOT NULL,
  hotel_id           uuid NOT NULL REFERENCES commercial.hotel (id) ON DELETE RESTRICT,
  worker_id          uuid REFERENCES personal.worker (id) ON DELETE RESTRICT,
  supervisor_user_id uuid NOT NULL REFERENCES identity."user" (id) ON DELETE RESTRICT,
  score        numeric(5,2) NOT NULL,
  observations text,

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6),
  created_by uuid NOT NULL REFERENCES identity."user" (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES identity."user" (id) ON DELETE RESTRICT,

  CONSTRAINT ck_audit_type CHECK (
    audit_type IN ('PERSONAL_PRESENTATION', 'ENVIRONMENT')),
  CONSTRAINT ck_audit_worker_by_type CHECK (
    (audit_type = 'PERSONAL_PRESENTATION' AND worker_id IS NOT NULL)
    OR (audit_type = 'ENVIRONMENT' AND worker_id IS NULL)),
  CONSTRAINT ck_audit_score_range CHECK (score >= 0 AND score <= 100)
);

ALTER TABLE supervision.audit
  ADD CONSTRAINT ux_audit_id_type UNIQUE (id, audit_type);

CREATE INDEX ix_audit_hotel ON supervision.audit (hotel_id, created_at DESC);

CREATE INDEX ix_audit_worker_recent
  ON supervision.audit (worker_id, created_at DESC)
  WHERE audit_type = 'PERSONAL_PRESENTATION';

CREATE INDEX ix_audit_supervisor ON supervision.audit (supervisor_user_id);
CREATE INDEX ix_audit_created_by ON supervision.audit (created_by);
CREATE INDEX ix_audit_updated_by ON supervision.audit (updated_by);

CREATE TRIGGER tg_audit_updated_at BEFORE UPDATE ON supervision.audit
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON supervision.audit TO app_user;


CREATE TABLE supervision.audit_response (
  id uuid PRIMARY KEY,

  audit_id          uuid NOT NULL,
  checklist_item_id uuid NOT NULL,
  audit_type        text NOT NULL,
  value             text NOT NULL,

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6),
  updated_by uuid REFERENCES identity."user" (id) ON DELETE RESTRICT,

  CONSTRAINT ck_audit_response_value CHECK (value IN ('CUMPLE', 'NO', 'N/A')),

  CONSTRAINT fk_audit_response_audit FOREIGN KEY (audit_id, audit_type)
    REFERENCES supervision.audit (id, audit_type) ON DELETE RESTRICT,
  CONSTRAINT fk_audit_response_item FOREIGN KEY (checklist_item_id, audit_type)
    REFERENCES catalogs.audit_checklist_item (id, audit_type) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX ux_audit_response_item
  ON supervision.audit_response (audit_id, checklist_item_id);

CREATE INDEX ix_audit_response_item ON supervision.audit_response (checklist_item_id);
CREATE INDEX ix_audit_response_updated_by ON supervision.audit_response (updated_by);

CREATE TRIGGER tg_audit_response_updated_at BEFORE UPDATE ON supervision.audit_response
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON supervision.audit_response TO app_user;


CREATE TABLE supervision.audit_response_history (
  id                 uuid PRIMARY KEY,
  audit_response_id  uuid NOT NULL REFERENCES supervision.audit_response (id) ON DELETE RESTRICT,
  previous_value     text NOT NULL,
  new_value          text NOT NULL,
  changed_by         uuid NOT NULL REFERENCES identity."user" (id) ON DELETE RESTRICT,
  changed_at         timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT ck_audit_response_history_previous CHECK (previous_value IN ('CUMPLE', 'NO', 'N/A')),
  CONSTRAINT ck_audit_response_history_new CHECK (new_value IN ('CUMPLE', 'NO', 'N/A'))
);

CREATE INDEX ix_audit_response_history_response
  ON supervision.audit_response_history (audit_response_id, changed_at DESC);
CREATE INDEX ix_audit_response_history_changed_by
  ON supervision.audit_response_history (changed_by);

GRANT SELECT, INSERT ON supervision.audit_response_history TO app_user;
