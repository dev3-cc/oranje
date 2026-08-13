-- Negro deja de ser permanente, y el Pool gana su vista.
--
-- Blacklist.md decia "Negro es PERMANENTE. No existe proceso de rehabilitacion ni
-- instancia de apelacion", y sobre eso se habia disenado worker_id como UNIQUE:
-- un segundo veto no significaba nada porque no habia forma de salir del primero.
--
-- El usuario cambio la regla el 2026-08-13: los perfiles de administrador pueden
-- levantar el veto, y el colaborador regresa a Blanco para que la Reclutadora lo
-- revalide. Eso convierte blacklist_entry en HISTORIAL: la misma persona puede
-- entrar, salir y volver a entrar.

-- El unico simple se va: ya no vale "una fila por colaborador, para siempre".
DROP INDEX IF EXISTS coverage.ux_blacklist_worker;

ALTER TABLE coverage.blacklist_entry
  ADD COLUMN lifted_at   timestamptz(6),
  ADD COLUMN lifted_by   uuid,
  ADD COLUMN lift_reason text;

ALTER TABLE coverage.blacklist_entry
  ADD CONSTRAINT blacklist_entry_lifted_by_fkey
  FOREIGN KEY (lifted_by) REFERENCES identity."user" (id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los tres campos del levantamiento van juntos o no van. Sin esto se podria
-- marcar lifted_at sin decir quien lo levanto ni por que — y levantar un veto es
-- justo la accion que mas necesita quedar atribuida.
ALTER TABLE coverage.blacklist_entry
  ADD CONSTRAINT ck_blacklist_lift CHECK (
    (lifted_at IS NULL     AND lifted_by IS NULL     AND lift_reason IS NULL)
    OR
    (lifted_at IS NOT NULL AND lifted_by IS NOT NULL AND lift_reason IS NOT NULL));

-- Un veto no se puede levantar antes de imponerse.
ALTER TABLE coverage.blacklist_entry
  ADD CONSTRAINT ck_blacklist_lift_after CHECK (
    lifted_at IS NULL OR lifted_at >= occurred_at);

-- Historial SI, pero un solo veto VIGENTE a la vez. Es lo que conserva el sentido
-- del unico viejo sin impedir que la persona vuelva a entrar despues.
CREATE UNIQUE INDEX ux_blacklist_active
  ON coverage.blacklist_entry (worker_id)
  WHERE lifted_at IS NULL;

CREATE INDEX ix_blacklist_worker
  ON coverage.blacklist_entry (worker_id, occurred_at DESC);

-- ###########################################################################
-- El Pool de Colaboradores
--
-- No es una tabla, y esto no es un atajo: el vault lo dice literal — "el registro
-- del colaborador queda guardado en la pool; lo que va cambiando es su estatus".
-- O sea que el Pool ES personal.worker leido por su estado. Una tabla aparte
-- seria una segunda copia del colaborador, y dos copias son dos lugares que
-- mantener.
--
-- Lo que la vista aporta es que la definicion de "disponible" viva en UN solo
-- lugar. Sin ella cada pantalla escribe su propio filtro, y basta que una olvide
-- excluir a los vetados para mostrar en el Pool a alguien en blacklist.
--
-- Los 5 filtros que pide Pool de Colaboradores.md —posicion, zona, idioma,
-- modalidad y disponibilidad— salen todos de columnas que ya estan aqui.
-- ###########################################################################

CREATE VIEW coverage.vw_pool AS
SELECT
  w.id,
  w.full_name,
  w.phone,
  w.zone_id,                 -- filtro: zona, para asignar a hoteles cercanos
  w.catalog_position_id,     -- filtro: posicion
  w.english_level_id,        -- filtro: idioma
  w.hiring_modality_id,      -- filtro: modalidad
  w.experience_level,
  w.transport_type,
  w.status_light_state_id,   -- filtro: disponibilidad
  s.code  AS status_code,
  s.color AS status_color,
  w.is_profile_complete,
  w.age
FROM personal.vw_worker w
JOIN catalogs.status_light_state s
  ON s.id = w.status_light_state_id
 AND s.status_light_code = 'WORKER'
WHERE w.deleted_at IS NULL
  -- Los DOS estados en que el colaborador es asignable. Verde fuerte es el que
  -- quedo libre o recien validado; Amarillo es el que se declaro disponible por
  -- su cuenta durante un descanso.
  AND s.code IN ('STRONG_GREEN', 'YELLOW')
  -- Sin veto VIGENTE. Ojo con el matiz: un colaborador con un veto ya levantado
  -- si vuelve al Pool — por eso es lifted_at IS NULL y no la mera existencia de
  -- la fila.
  AND NOT EXISTS (
    SELECT 1 FROM coverage.blacklist_entry b
     WHERE b.worker_id = w.id AND b.lifted_at IS NULL);

GRANT SELECT ON coverage.vw_pool TO app_user;
