-- Alinea el esquema con "Ventas - Modelo de Datos v2.drawio", que es la
-- especificacion. Auditadas las 3 paginas contra la base: 5 diferencias.

-- ---------------------------------------------------------------------------
-- 1. El CHECK de cierre solo cubria la mitad del caso.
--
-- La pagina 3 pide `(closed_at IS NULL) = (close_reason_id IS NULL)`: cerrar
-- sin motivo y tener motivo sin cerrar son el mismo error visto de dos lados.
-- Lo que habia bloqueaba el segundo y dejaba pasar el primero, o sea permitia
-- cerrar un ciclo comercial sin decir por que.
-- ---------------------------------------------------------------------------

ALTER TABLE "commercial"."prospect"
  DROP CONSTRAINT "ck_prospect_close_reason_con_fecha";

ALTER TABLE "commercial"."prospect"
  ADD CONSTRAINT "ck_prospect_close_reason_with_date"
  CHECK ((closed_at IS NULL) = (close_reason_id IS NULL));

-- ---------------------------------------------------------------------------
-- 2. Dos CHECK de la pagina 3 que nunca se crearon.
-- ---------------------------------------------------------------------------

ALTER TABLE "identity"."user"
  ADD CONSTRAINT "ck_user_reports_to_not_self"
  CHECK (reports_to_user_id IS DISTINCT FROM id);

ALTER TABLE "catalogs"."status_light_transition"
  ADD CONSTRAINT "ck_status_light_transition_no_self"
  CHECK (from_state_id <> to_state_id);

-- ---------------------------------------------------------------------------
-- 3. `ix_prospect_owner` estaba incompleto.
--
-- La pagina 3 lo pide como (owner_user_id, onboarding_state_id): la consulta
-- que lo justifica es "mis prospectos" del BD agrupados por estado, y con solo
-- la primera columna Postgres filtra por duenio y despues ordena a mano.
-- Igualdad primero (§7).
-- ---------------------------------------------------------------------------

DROP INDEX "commercial"."ix_prospect_owner";

CREATE INDEX "ix_prospect_owner"
  ON "commercial"."prospect" (owner_user_id, onboarding_state_id);

-- ---------------------------------------------------------------------------
-- 4. Faltaba `vw_prospect`, la otra mitad de la pagina 1.
--
-- "Es cliente?" es un join, no una columna: vw_client son los ciclos abiertos
-- en ORANGE o BLACK, y vw_prospect los otros siete codigos. Sin la segunda, la
-- consulta del pipeline la reescribe cada quien a mano.
-- ---------------------------------------------------------------------------

CREATE VIEW "commercial"."vw_prospect" AS
SELECT h.*
FROM "commercial"."hotel" h
JOIN "commercial"."prospect" p
  ON p.hotel_id = h.id
 AND p.closed_at IS NULL
JOIN "catalogs"."status_light_state" s
  ON s.id = p.onboarding_state_id
WHERE s.code NOT IN ('ORANGE', 'BLACK');

-- ---------------------------------------------------------------------------
-- 5. Cuatro identificadores en espanol. D-11 no admite excepciones.
-- Ninguno lo referencia codigo todavia, asi que renombrar es gratis hoy.
-- ---------------------------------------------------------------------------

ALTER INDEX "identity"."ux_role_permission_rol_modulo_accion"
  RENAME TO "ux_role_permission_role_module_action";

ALTER INDEX "catalogs"."ux_status_light_transition_paso"
  RENAME TO "ux_status_light_transition_step";

ALTER TABLE "identity"."user"
  RENAME CONSTRAINT "ck_user_department_requiere_hotel"
  TO "ck_user_department_requires_hotel";
