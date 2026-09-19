-- El destino de una transicion no siempre es un estado fijo.
--
-- El Semaforo del Colaborador tiene DOS transiciones cuyo destino es "el estado
-- previo", y cual sea depende de donde venia el colaborador en tiempo de
-- ejecucion:
--
--   Morado -> estado previo   el sistema lo regresa cuando vuelve a ponchar
--   Cafe   -> estado previo   vence o se cancela la asignacion temporal
--                             (Verde fuerte si estaba libre, Amarillo si sigue
--                              en periodo de descanso)
--
-- Como par fijo (from_state_id, to_state_id) no caben. La alternativa era
-- expandirlas a una fila por cada estado previo POSIBLE, y eso obliga a adivinar
-- de donde puede venir el colaborador: si manana entra un estado nuevo, la tabla
-- queda incompleta en silencio.
--
-- Se resuelve con una bandera. El servicio de transicion lee el estado previo
-- del ultimo renglon de la tabla de historia del semaforo, que existe justo para
-- esto (D-14).

ALTER TABLE catalogs.status_light_transition
  ADD COLUMN returns_to_previous boolean NOT NULL DEFAULT false;

-- Con la bandera prendida no hay destino que guardar.
ALTER TABLE catalogs.status_light_transition
  ALTER COLUMN to_state_id DROP NOT NULL;

-- Exactamente una de las dos formas, nunca las dos ni ninguna.
ALTER TABLE catalogs.status_light_transition
  ADD CONSTRAINT ck_status_light_transition_target CHECK (
    (returns_to_previous = false AND to_state_id IS NOT NULL)
    OR
    (returns_to_previous = true  AND to_state_id IS NULL)
  );

-- El indice unico se rehace con NULLS NOT DISTINCT.
--
-- Por defecto Postgres considera que dos NULL son distintos, asi que sin esta
-- clausula el indice dejaria pasar DOS filas (from_state_id, NULL, role) para el
-- mismo paso — justo las filas de returns_to_previous, que son las que traen el
-- NULL. Con la clausula, un segundo "Morado -> estado previo" para el mismo rol
-- lo rechaza el motor.
--
-- Requiere Postgres 15, que es la version de la instancia.
DROP INDEX IF EXISTS catalogs.ux_status_light_transition_step;

CREATE UNIQUE INDEX ux_status_light_transition_step
  ON catalogs.status_light_transition (from_state_id, to_state_id, authorized_role_id)
  NULLS NOT DISTINCT;
