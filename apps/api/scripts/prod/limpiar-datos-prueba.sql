-- Limpieza de datos de prueba tras clonar staging a producción (2026-09-19).
--
-- Staging y dev comparten base, así que el clon trae junto lo real (los 307
-- colaboradores migrados de AWS, los hoteles de Georgia, el personal interno)
-- y la basura de meses de pruebas (hoteles «Morado», usuarios @oranje.local,
-- requisiciones de las suites). Esto quita la basura y NO toca lo real.
--
-- Se corre DENTRO de una transacción (el .sh lo envuelve) y como dueño del
-- esquema. Es idempotente: sin basura, no borra nada.
--
-- Orden: hijos antes que padres, porque casi todas las FK son RESTRICT a
-- propósito (Estándares de BD §6). Al final, los usuarios de prueba se borran
-- uno por uno con savepoint: si alguno sigue referenciado por un dato real,
-- se queda desactivado en vez de reventar la limpieza.

-- 1) Qué es basura.
-- Las suites bautizan sus hoteles «Hotel Algo 1789…» (13 dígitos de timestamp)
-- y los crean con un usuario @oranje.local; cualquiera de las dos señales basta.
CREATE TEMP TABLE hotel_prueba AS
SELECT h.id FROM commercial.hotel h
  LEFT JOIN identity."user" u ON u.id = h.created_by
 WHERE h.name ~ '\d{13}$'
    OR h.name ILIKE '%prueba%'
    OR u.email LIKE '%@oranje.local';

CREATE TEMP TABLE worker_prueba AS
SELECT w.id FROM personal.worker w
  LEFT JOIN identity."user" u ON u.id = w.created_by
 WHERE w.deleted_at IS NOT NULL                       -- eliminados del Pool
    OR u.email LIKE '%@oranje.local'                  -- creados por las suites
    OR w.full_name ~ '^(Reasignar|SinAsignar|ConAsignacion|Eliminar|Acceso|Buzon|Incompleto|Prueba) '
    OR w.full_name = 'Colaborador de la prueba';

-- Ojo: @tmp.com y @no.no NO son de prueba — son los correos placeholder de las
-- cuentas de transición de la migración desde AWS (legacy_user_id).
CREATE TEMP TABLE usuario_prueba AS
SELECT id FROM identity."user"
 WHERE email LIKE '%@oranje.local'
    OR hotel_id IN (SELECT id FROM hotel_prueba);

CREATE TEMP TABLE requisicion_prueba AS
SELECT id FROM demand.requisition WHERE hotel_id IN (SELECT id FROM hotel_prueba);

-- 2) Cadena de la requisición de prueba.
DELETE FROM settlement.invoice_detail   WHERE requisition_id IN (SELECT id FROM requisicion_prueba);
DELETE FROM settlement.consolidation_detail WHERE requisition_id IN (SELECT id FROM requisicion_prueba);
DELETE FROM operations.punch_mark WHERE timesheet_day_id IN (
  SELECT d.id FROM operations.timesheet_day d JOIN operations.timesheet t ON t.id = d.timesheet_id
   WHERE t.requisition_id IN (SELECT id FROM requisicion_prueba) OR t.worker_id IN (SELECT id FROM worker_prueba));
DELETE FROM operations.timesheet_day WHERE timesheet_id IN (
  SELECT id FROM operations.timesheet
   WHERE requisition_id IN (SELECT id FROM requisicion_prueba) OR worker_id IN (SELECT id FROM worker_prueba));
DELETE FROM operations.timesheet
 WHERE requisition_id IN (SELECT id FROM requisicion_prueba) OR worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM operations.schedule_entry
 WHERE worker_id IN (SELECT id FROM worker_prueba)
    OR assignment_id IN (SELECT a.id FROM coverage.assignment a JOIN demand.slot s ON s.id = a.slot_id
                          JOIN demand."position" p ON p.id = s.position_id
                         WHERE p.requisition_id IN (SELECT id FROM requisicion_prueba))
    OR schedule_id IN (SELECT id FROM operations.schedule WHERE hotel_id IN (SELECT id FROM hotel_prueba));
DELETE FROM operations.schedule WHERE hotel_id IN (SELECT id FROM hotel_prueba);
DELETE FROM coverage.assignment
 WHERE worker_id IN (SELECT id FROM worker_prueba)
    OR slot_id IN (SELECT s.id FROM demand.slot s JOIN demand."position" p ON p.id = s.position_id
                    WHERE p.requisition_id IN (SELECT id FROM requisicion_prueba));
DELETE FROM coverage.participation WHERE requisition_id IN (SELECT id FROM requisicion_prueba);
DELETE FROM demand.slot WHERE position_id IN (
  SELECT id FROM demand."position" WHERE requisition_id IN (SELECT id FROM requisicion_prueba));
DELETE FROM demand."position" WHERE requisition_id IN (SELECT id FROM requisicion_prueba);
DELETE FROM demand.requisition_state_history WHERE requisition_id IN (SELECT id FROM requisicion_prueba);
DELETE FROM demand.requisition WHERE id IN (SELECT id FROM requisicion_prueba);

-- 3) Lo demás que cuelga del hotel de prueba.
DELETE FROM supervision.audit_response_history WHERE audit_response_id IN (
  SELECT r.id FROM supervision.audit_response r JOIN supervision.audit a ON a.id = r.audit_id
   WHERE a.hotel_id IN (SELECT id FROM hotel_prueba) OR a.worker_id IN (SELECT id FROM worker_prueba));
DELETE FROM supervision.audit_response WHERE audit_id IN (
  SELECT id FROM supervision.audit
   WHERE hotel_id IN (SELECT id FROM hotel_prueba) OR worker_id IN (SELECT id FROM worker_prueba));
DELETE FROM supervision.audit
 WHERE hotel_id IN (SELECT id FROM hotel_prueba) OR worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM supervision.work_accident
 WHERE hotel_id IN (SELECT id FROM hotel_prueba) OR worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM settlement.invoice WHERE hotel_id IN (SELECT id FROM hotel_prueba);
DELETE FROM commercial.contract_rate WHERE contract_id IN (
  SELECT id FROM commercial.contract WHERE hotel_id IN (SELECT id FROM hotel_prueba));
DELETE FROM commercial.contract WHERE hotel_id IN (SELECT id FROM hotel_prueba);
DELETE FROM commercial.proposal_rate WHERE proposal_id IN (
  SELECT p.id FROM commercial.proposal p JOIN commercial.prospect pr ON pr.id = p.prospect_id
   WHERE pr.hotel_id IN (SELECT id FROM hotel_prueba));
DELETE FROM commercial.proposal WHERE prospect_id IN (
  SELECT id FROM commercial.prospect WHERE hotel_id IN (SELECT id FROM hotel_prueba));
DELETE FROM commercial.contact_attempt WHERE hotel_id IN (SELECT id FROM hotel_prueba);
DELETE FROM commercial.prospect_state_history WHERE prospect_id IN (
  SELECT id FROM commercial.prospect WHERE hotel_id IN (SELECT id FROM hotel_prueba));
DELETE FROM commercial.prospect WHERE hotel_id IN (SELECT id FROM hotel_prueba);
DELETE FROM commercial.hotel_contact WHERE hotel_id IN (SELECT id FROM hotel_prueba);

-- 4) El colaborador de prueba y su expediente.
DELETE FROM settlement.deduction WHERE consolidation_id IN (
  SELECT id FROM settlement.consolidation WHERE worker_id IN (SELECT id FROM worker_prueba));
DELETE FROM settlement.consolidation WHERE worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM coverage.blacklist_entry WHERE worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM personal.worker_document WHERE worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM personal.worker_rate WHERE worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM personal.worker_state_history WHERE worker_id IN (SELECT id FROM worker_prueba);
DELETE FROM personal.worker WHERE id IN (SELECT id FROM worker_prueba);

-- 5) Lo que referencia a los usuarios de prueba (incluidas las cuentas de
--    los hoteles de prueba).
DELETE FROM identity.refresh_token WHERE user_id IN (SELECT id FROM usuario_prueba);
DELETE FROM notifications.device WHERE user_id IN (SELECT id FROM usuario_prueba);
DELETE FROM notifications.notification
 WHERE user_id IN (SELECT id FROM usuario_prueba) OR actor_user_id IN (SELECT id FROM usuario_prueba);
DELETE FROM commercial.user_zone WHERE user_id IN (SELECT id FROM usuario_prueba);
DELETE FROM journal.journal WHERE actor_user_id IN (SELECT id FROM usuario_prueba);
UPDATE identity."user" SET reports_to_user_id = NULL WHERE reports_to_user_id IN (SELECT id FROM usuario_prueba);
-- La cuenta del hotel apunta al hotel y el hotel a quien lo creó: se corta el
-- ciclo soltando el hotel de la cuenta antes de borrar el hotel.
UPDATE identity."user" SET hotel_id = NULL
 WHERE id IN (SELECT id FROM usuario_prueba) OR hotel_id IN (SELECT id FROM hotel_prueba);

-- 6) El hotel de prueba, ya sin nada que le cuelgue.
DELETE FROM commercial.hotel WHERE id IN (SELECT id FROM hotel_prueba);

-- 7) Usuarios de prueba, uno por uno: el que siga referenciado por un dato
--    real se queda, desactivado, y se reporta.
DO $$
DECLARE
  u RECORD;
  borrados int := 0;
  conservados int := 0;
BEGIN
  FOR u IN SELECT id FROM usuario_prueba LOOP
    BEGIN
      DELETE FROM identity."user" WHERE id = u.id;
      borrados := borrados + 1;
    EXCEPTION WHEN foreign_key_violation THEN
      UPDATE identity."user" SET is_active = false WHERE id = u.id;
      conservados := conservados + 1;
    END;
  END LOOP;
  RAISE NOTICE 'usuarios de prueba borrados: %, conservados (desactivados, aún referenciados): %', borrados, conservados;
END $$;

-- 8) Lo que no viaja entre ambientes: sesiones y dispositivos de todos.
DELETE FROM identity.refresh_token;
DELETE FROM notifications.device;

SELECT 'hoteles'        AS tabla, count(*) FROM commercial.hotel
UNION ALL SELECT 'colaboradores', count(*) FROM personal.worker
UNION ALL SELECT 'usuarios activos', count(*) FROM identity."user" WHERE is_active
UNION ALL SELECT 'usuarios inactivos', count(*) FROM identity."user" WHERE NOT is_active
UNION ALL SELECT 'requisiciones', count(*) FROM demand.requisition
UNION ALL SELECT 'prospectos', count(*) FROM commercial.prospect;
