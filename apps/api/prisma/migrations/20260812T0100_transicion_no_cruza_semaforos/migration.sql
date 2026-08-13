-- Nada impedia que una transicion cruzara semaforos.
--
-- Las FK de status_light_transition apuntaban a status_light_state(id), a secas.
-- Con eso, una fila podia salir de un estado del Onboarding y llegar a uno del
-- Semaforo del Colaborador: dos semaforos distintos, un paso imposible. La tabla
-- estaba limpia solo porque el seed es correcto, no porque el motor lo impidiera.
--
-- Se cierra con el mismo patron que ya usan demand.requisition y demand.position
-- (D-19): una columna con el semaforo, y las FK pasan a ser compuestas contra
-- (id, status_light_id). Como AMBAS llaves comparan contra la MISMA columna, el
-- origen y el destino quedan obligados a ser del mismo semaforo por construccion
-- — no hace falta un CHECK aparte.

ALTER TABLE catalogs.status_light_transition
  ADD COLUMN status_light_id uuid;

-- Backfill desde el origen, que es el que nunca es nulo.
UPDATE catalogs.status_light_transition t
   SET status_light_id = f.status_light_id
  FROM catalogs.status_light_state f
 WHERE f.id = t.from_state_id;

ALTER TABLE catalogs.status_light_transition
  ALTER COLUMN status_light_id SET NOT NULL;

ALTER TABLE catalogs.status_light_transition
  ADD CONSTRAINT status_light_transition_status_light_id_fkey
  FOREIGN KEY (status_light_id)
  REFERENCES catalogs.status_light (id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las FK simples se van; entran las compuestas.
ALTER TABLE catalogs.status_light_transition
  DROP CONSTRAINT IF EXISTS status_light_transition_from_state_id_fkey,
  DROP CONSTRAINT IF EXISTS status_light_transition_to_state_id_fkey;

ALTER TABLE catalogs.status_light_transition
  ADD CONSTRAINT status_light_transition_from_state_id_status_light_id_fkey
  FOREIGN KEY (from_state_id, status_light_id)
  REFERENCES catalogs.status_light_state (id, status_light_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- La del destino es nulable a proposito. Con MATCH SIMPLE —el default— una llave
-- compuesta con una parte NULL no se verifica, que es exactamente lo que hace
-- falta cuando returns_to_previous es true y no hay destino.
ALTER TABLE catalogs.status_light_transition
  ADD CONSTRAINT status_light_transition_to_state_id_status_light_id_fkey
  FOREIGN KEY (to_state_id, status_light_id)
  REFERENCES catalogs.status_light_state (id, status_light_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX ix_status_light_transition_light
  ON catalogs.status_light_transition (status_light_id);
