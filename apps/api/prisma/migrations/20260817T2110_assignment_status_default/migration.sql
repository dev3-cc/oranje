-- La columna nacio con DEFAULT 'active' y un CHECK que solo admite
-- ('ACTIVE','CLOSED','CANCELLED'). Toda insercion que se apoyara en el default
-- moria contra ck_assignment_status, asi que la tabla era inusable por su
-- camino normal. Verificado contra la instancia antes de tocar nada.
--
-- Y el indice parcial ux_slot_active_assignment filtra por status = 'ACTIVE',
-- de modo que en minusculas tampoco habria impedido dos asignaciones activas
-- sobre el mismo slot: la garantia de no-doble-asignacion no existia.
--
-- La tabla esta vacia, asi que no hay filas que migrar.

ALTER TABLE coverage.assignment
  ALTER COLUMN status SET DEFAULT 'ACTIVE';
