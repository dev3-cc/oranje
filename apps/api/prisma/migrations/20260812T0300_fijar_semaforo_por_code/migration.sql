-- La FK compuesta NO fijaba el semaforo. Solo impedia pares mal formados.
--
-- El patron era: (state_id, status_light_id) -> status_light_state(id,
-- status_light_id). Eso garantiza que el estado y el semaforo declarado coincidan
-- ENTRE SI, pero no que sean los del semaforo correcto. Un worker que declarara
-- status_light_id = ONBOARDING podia tomar NARANJA del Onboarding, porque el par
-- existe. Demostrado con un insert que paso cuando debia fallar.
--
-- El candado que faltaba es un CHECK contra el semaforo, y ahi esta el detalle:
-- NO puede ser contra el uuid. El id es uuid v7 generado por el seed, asi que
-- cambia en cada ambiente — un CHECK con el literal seria valido en dev y falso
-- en staging. El `code` en cambio es estable: 'WORKER' es 'WORKER' en todas
-- partes, y ya es UNIQUE en status_light.
--
-- Asi que las 6 referencias pasan de guardar el uuid del semaforo a guardar su
-- code, y cada una gana un CHECK que la fija. Las FK compuestas siguen ahi, ahora
-- colgadas de (id, status_light_code).
--
-- TODO ESTE ARCHIVO ES IDEMPOTENTE. El primer intento se aplico a medias porque
-- `migrate deploy` no envuelve el archivo en una transaccion, asi que cada paso
-- lleva IF EXISTS / IF NOT EXISTS y cada constraint se borra antes de crearse.

-- ###########################################################################
-- 0. La vista se cae y se vuelve a crear al final
--
-- personal.vw_worker se definio con SELECT w.*, asi que Postgres la ato a la
-- lista de columnas del momento y no deja tocar ninguna: "cannot drop column
-- status_light_id because view personal.vw_worker depends on it".
-- ###########################################################################

DROP VIEW IF EXISTS personal.vw_worker;

-- ###########################################################################
-- 1. status_light_state gana el code de su semaforo
-- ###########################################################################

ALTER TABLE catalogs.status_light_state
  ADD COLUMN IF NOT EXISTS status_light_code text;

UPDATE catalogs.status_light_state s
   SET status_light_code = l.code
  FROM catalogs.status_light l
 WHERE l.id = s.status_light_id AND s.status_light_code IS DISTINCT FROM l.code;

ALTER TABLE catalogs.status_light_state
  ALTER COLUMN status_light_code SET NOT NULL;

-- ON UPDATE CASCADE porque si alguien renombra el code del semaforo, tiene que
-- arrastrar a sus estados.
ALTER TABLE catalogs.status_light_state
  DROP CONSTRAINT IF EXISTS status_light_state_status_light_code_fkey;
ALTER TABLE catalogs.status_light_state
  ADD CONSTRAINT status_light_state_status_light_code_fkey
  FOREIGN KEY (status_light_code) REFERENCES catalogs.status_light (code)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- De aqui cuelgan todas las FK compuestas nuevas.
CREATE UNIQUE INDEX IF NOT EXISTS ux_status_light_state_id_code
  ON catalogs.status_light_state (id, status_light_code);

-- ###########################################################################
-- 2. Las 6 referencias: uuid -> code, mas su CHECK
-- ###########################################################################

-- ---------- personal.worker : WORKER -------------------------
ALTER TABLE personal.worker ADD COLUMN IF NOT EXISTS status_light_code text;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = split_part('personal.worker','.',1)
               AND table_name  = 'worker' AND column_name = 'status_light_id') THEN
    EXECUTE 'UPDATE personal.worker t SET status_light_code = l.code
               FROM catalogs.status_light l WHERE l.id = t.status_light_id';
  END IF;
  EXECUTE 'UPDATE personal.worker SET status_light_code = ''WORKER'' WHERE status_light_code IS NULL';
END $$;
ALTER TABLE personal.worker ALTER COLUMN status_light_code SET NOT NULL;
ALTER TABLE personal.worker DROP CONSTRAINT IF EXISTS worker_status_light_state_id_status_light_id_fkey;
ALTER TABLE personal.worker DROP COLUMN IF EXISTS status_light_id;
ALTER TABLE personal.worker DROP CONSTRAINT IF EXISTS worker_status_light_state_id_status_light_code_fkey;
ALTER TABLE personal.worker
  ADD CONSTRAINT worker_status_light_state_id_status_light_code_fkey
  FOREIGN KEY (status_light_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE personal.worker DROP CONSTRAINT IF EXISTS ck_worker_light;
ALTER TABLE personal.worker ADD CONSTRAINT ck_worker_light CHECK (status_light_code = 'WORKER');

-- ---------- personal.worker_state_history : WORKER -----------
ALTER TABLE personal.worker_state_history ADD COLUMN IF NOT EXISTS status_light_code text;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = split_part('personal.worker_state_history','.',1)
               AND table_name  = 'worker_state_history' AND column_name = 'status_light_id') THEN
    EXECUTE 'UPDATE personal.worker_state_history t SET status_light_code = l.code
               FROM catalogs.status_light l WHERE l.id = t.status_light_id';
  END IF;
  EXECUTE 'UPDATE personal.worker_state_history SET status_light_code = ''WORKER'' WHERE status_light_code IS NULL';
END $$;
ALTER TABLE personal.worker_state_history ALTER COLUMN status_light_code SET NOT NULL;
ALTER TABLE personal.worker_state_history DROP CONSTRAINT IF EXISTS worker_state_history_from_state_id_status_light_id_fkey;
ALTER TABLE personal.worker_state_history DROP CONSTRAINT IF EXISTS worker_state_history_to_state_id_status_light_id_fkey;
ALTER TABLE personal.worker_state_history DROP COLUMN IF EXISTS status_light_id;
ALTER TABLE personal.worker_state_history DROP CONSTRAINT IF EXISTS worker_state_history_from_state_id_status_light_code_fkey;
ALTER TABLE personal.worker_state_history
  ADD CONSTRAINT worker_state_history_from_state_id_status_light_code_fkey
  FOREIGN KEY (from_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE personal.worker_state_history DROP CONSTRAINT IF EXISTS worker_state_history_to_state_id_status_light_code_fkey;
ALTER TABLE personal.worker_state_history
  ADD CONSTRAINT worker_state_history_to_state_id_status_light_code_fkey
  FOREIGN KEY (to_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE personal.worker_state_history DROP CONSTRAINT IF EXISTS ck_worker_state_history_light;
ALTER TABLE personal.worker_state_history ADD CONSTRAINT ck_worker_state_history_light CHECK (status_light_code = 'WORKER');

-- ---------- commercial.prospect : ONBOARDING -----------------
ALTER TABLE commercial.prospect ADD COLUMN IF NOT EXISTS status_light_code text;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = split_part('commercial.prospect','.',1)
               AND table_name  = 'prospect' AND column_name = 'status_light_id') THEN
    EXECUTE 'UPDATE commercial.prospect t SET status_light_code = l.code
               FROM catalogs.status_light l WHERE l.id = t.status_light_id';
  END IF;
  EXECUTE 'UPDATE commercial.prospect SET status_light_code = ''ONBOARDING'' WHERE status_light_code IS NULL';
END $$;
ALTER TABLE commercial.prospect ALTER COLUMN status_light_code SET NOT NULL;
ALTER TABLE commercial.prospect DROP CONSTRAINT IF EXISTS prospect_onboarding_state_id_status_light_id_fkey;
ALTER TABLE commercial.prospect DROP COLUMN IF EXISTS status_light_id;
ALTER TABLE commercial.prospect DROP CONSTRAINT IF EXISTS prospect_onboarding_state_id_status_light_code_fkey;
ALTER TABLE commercial.prospect
  ADD CONSTRAINT prospect_onboarding_state_id_status_light_code_fkey
  FOREIGN KEY (onboarding_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE commercial.prospect DROP CONSTRAINT IF EXISTS ck_prospect_light;
ALTER TABLE commercial.prospect ADD CONSTRAINT ck_prospect_light CHECK (status_light_code = 'ONBOARDING');

-- ---------- demand.requisition : REQUISITION -----------------
ALTER TABLE demand.requisition ADD COLUMN IF NOT EXISTS status_light_code text;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = split_part('demand.requisition','.',1)
               AND table_name  = 'requisition' AND column_name = 'status_light_id') THEN
    EXECUTE 'UPDATE demand.requisition t SET status_light_code = l.code
               FROM catalogs.status_light l WHERE l.id = t.status_light_id';
  END IF;
  EXECUTE 'UPDATE demand.requisition SET status_light_code = ''REQUISITION'' WHERE status_light_code IS NULL';
END $$;
ALTER TABLE demand.requisition ALTER COLUMN status_light_code SET NOT NULL;
ALTER TABLE demand.requisition DROP CONSTRAINT IF EXISTS requisition_status_light_state_id_status_light_id_fkey;
ALTER TABLE demand.requisition DROP COLUMN IF EXISTS status_light_id;
ALTER TABLE demand.requisition DROP CONSTRAINT IF EXISTS requisition_status_light_state_id_status_light_code_fkey;
ALTER TABLE demand.requisition
  ADD CONSTRAINT requisition_status_light_state_id_status_light_code_fkey
  FOREIGN KEY (status_light_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE demand.requisition DROP CONSTRAINT IF EXISTS ck_requisition_light;
ALTER TABLE demand.requisition ADD CONSTRAINT ck_requisition_light CHECK (status_light_code = 'REQUISITION');

-- ---------- commercial.prospect_state_history : ONBOARDING ----------
-- Esta tabla NO tenia columna de semaforo: sus FK eran simples contra
-- status_light_state(id), asi que ni siquiera impedia pares mal formados.
ALTER TABLE commercial.prospect_state_history ADD COLUMN IF NOT EXISTS status_light_code text;
UPDATE commercial.prospect_state_history SET status_light_code = 'ONBOARDING' WHERE status_light_code IS NULL;
ALTER TABLE commercial.prospect_state_history ALTER COLUMN status_light_code SET NOT NULL;
ALTER TABLE commercial.prospect_state_history DROP CONSTRAINT IF EXISTS prospect_state_history_from_state_id_fkey;
ALTER TABLE commercial.prospect_state_history DROP CONSTRAINT IF EXISTS prospect_state_history_to_state_id_fkey;
ALTER TABLE commercial.prospect_state_history DROP CONSTRAINT IF EXISTS prospect_state_history_from_light_code_fkey;
ALTER TABLE commercial.prospect_state_history ADD CONSTRAINT prospect_state_history_from_light_code_fkey
  FOREIGN KEY (from_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE commercial.prospect_state_history DROP CONSTRAINT IF EXISTS prospect_state_history_to_light_code_fkey;
ALTER TABLE commercial.prospect_state_history ADD CONSTRAINT prospect_state_history_to_light_code_fkey
  FOREIGN KEY (to_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE commercial.prospect_state_history DROP CONSTRAINT IF EXISTS ck_prospect_state_history_light;
ALTER TABLE commercial.prospect_state_history ADD CONSTRAINT ck_prospect_state_history_light CHECK (status_light_code = 'ONBOARDING');

-- ---------- demand.requisition_state_history : REQUISITION ----------
-- Esta tabla NO tenia columna de semaforo: sus FK eran simples contra
-- status_light_state(id), asi que ni siquiera impedia pares mal formados.
ALTER TABLE demand.requisition_state_history ADD COLUMN IF NOT EXISTS status_light_code text;
UPDATE demand.requisition_state_history SET status_light_code = 'REQUISITION' WHERE status_light_code IS NULL;
ALTER TABLE demand.requisition_state_history ALTER COLUMN status_light_code SET NOT NULL;
ALTER TABLE demand.requisition_state_history DROP CONSTRAINT IF EXISTS requisition_state_history_from_state_id_fkey;
ALTER TABLE demand.requisition_state_history DROP CONSTRAINT IF EXISTS requisition_state_history_to_state_id_fkey;
ALTER TABLE demand.requisition_state_history DROP CONSTRAINT IF EXISTS requisition_state_history_from_light_code_fkey;
ALTER TABLE demand.requisition_state_history ADD CONSTRAINT requisition_state_history_from_light_code_fkey
  FOREIGN KEY (from_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE demand.requisition_state_history DROP CONSTRAINT IF EXISTS requisition_state_history_to_light_code_fkey;
ALTER TABLE demand.requisition_state_history ADD CONSTRAINT requisition_state_history_to_light_code_fkey
  FOREIGN KEY (to_state_id, status_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE demand.requisition_state_history DROP CONSTRAINT IF EXISTS ck_requisition_state_history_light;
ALTER TABLE demand.requisition_state_history ADD CONSTRAINT ck_requisition_state_history_light CHECK (status_light_code = 'REQUISITION');

-- ---------- demand.position : DOS semaforos (D-19) ----------
-- La Requisicion carga tres semaforos y position sostiene dos. Cada par lleva su
-- propio code y su propio CHECK.
ALTER TABLE demand.position
  ADD COLUMN IF NOT EXISTS coverage_light_code text,
  ADD COLUMN IF NOT EXISTS urgency_light_code  text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='demand'
             AND table_name='position' AND column_name='coverage_light_id') THEN
    EXECUTE 'UPDATE demand.position p SET coverage_light_code = l.code
               FROM catalogs.status_light l WHERE l.id = p.coverage_light_id';
    EXECUTE 'UPDATE demand.position p SET urgency_light_code = l.code
               FROM catalogs.status_light l WHERE l.id = p.urgency_light_id';
  END IF;
  EXECUTE 'UPDATE demand.position SET coverage_light_code = ''POSITION_COVERAGE''
             WHERE coverage_light_code IS NULL';
END $$;

ALTER TABLE demand.position ALTER COLUMN coverage_light_code SET NOT NULL;

ALTER TABLE demand.position
  DROP CONSTRAINT IF EXISTS position_coverage_state_id_coverage_light_id_fkey,
  DROP CONSTRAINT IF EXISTS position_urgency_state_id_urgency_light_id_fkey;
ALTER TABLE demand.position
  DROP COLUMN IF EXISTS coverage_light_id,
  DROP COLUMN IF EXISTS urgency_light_id;

ALTER TABLE demand.position
  DROP CONSTRAINT IF EXISTS position_coverage_state_id_coverage_light_code_fkey,
  DROP CONSTRAINT IF EXISTS position_urgency_state_id_urgency_light_code_fkey,
  DROP CONSTRAINT IF EXISTS ck_position_coverage_light,
  DROP CONSTRAINT IF EXISTS ck_position_urgency_light;

ALTER TABLE demand.position
  ADD CONSTRAINT position_coverage_state_id_coverage_light_code_fkey
  FOREIGN KEY (coverage_state_id, coverage_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT position_urgency_state_id_urgency_light_code_fkey
  FOREIGN KEY (urgency_state_id, urgency_light_code)
  REFERENCES catalogs.status_light_state (id, status_light_code)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT ck_position_coverage_light
  CHECK (coverage_light_code = 'POSITION_COVERAGE'),
  -- La urgencia es nulable: la calcula un job despues de autorizar.
  ADD CONSTRAINT ck_position_urgency_light
  CHECK (urgency_light_code IS NULL OR urgency_light_code = 'URGENCY');

-- ###########################################################################
-- 3. La vista de vuelta
-- ###########################################################################

CREATE VIEW personal.vw_worker AS
SELECT
  w.*,
  (w.ssn_encrypted IS NOT NULL OR w.itin_encrypted IS NOT NULL) AS has_tax_id,
  (
    w.catalog_position_id            IS NOT NULL AND
    w.english_level_id               IS NOT NULL AND
    w.hiring_modality_id             IS NOT NULL AND
    w.experience_level               IS NOT NULL AND
    w.transport_type                 IS NOT NULL AND
    w.emergency_contact_name         IS NOT NULL AND
    w.emergency_contact_phone        IS NOT NULL AND
    w.emergency_contact_relationship IS NOT NULL AND
    w.blood_type                     IS NOT NULL
  ) AS is_profile_complete,
  date_part('year', age(w.birth_date))::int AS age
FROM personal.worker w;

GRANT SELECT ON personal.vw_worker TO app_user;
