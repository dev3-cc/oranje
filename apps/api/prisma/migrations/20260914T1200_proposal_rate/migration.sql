-- La Propuesta Personalizada cotiza POR PUESTO, no con una tarifa global.
-- Lo confirmo el contrato real de Courtyard & Fairfield Lithia Springs que
-- trajo Hugo: su Exhibit "A" es un cuadro de ocho posiciones con pay y bill
-- propios, y el margen NO es un porcentaje fijo (15.00 -> 19.50 son 30%,
-- 17.00 -> 21.85 son 28.5%, 16.00 -> 20.28 son 26.75%), asi que el bill no se
-- puede derivar del pay: cada renglon se negocia.
--
-- La tabla es ESPEJO de commercial.contract_rate (misma forma, misma
-- precision) porque el cuadro de la propuesta ES el Exhibit "A" del Documento
-- de T&C: al firmar se copia renglon por renglon, sin volver a teclearlo.
--
-- Cada VERSION de la propuesta lleva su cuadro completo, no un diff: asi se
-- puede comparar que cambio entre la v1 y la v2 (que es de lo que trata
-- renegociar en Cafe).
--
-- Expandir/contraer (Estandares de BD, seccion 8): proposal.pay_rate y
-- proposal.bill_rate se quedan por ahora para no romper las propuestas que ya
-- existen; se retiran en la migracion de contraer cuando no quede ninguna sin
-- renglones.
CREATE TABLE commercial.proposal_rate (
  id uuid PRIMARY KEY,

  proposal_id         uuid NOT NULL REFERENCES commercial.proposal (id) ON DELETE CASCADE,
  catalog_position_id uuid NOT NULL REFERENCES catalogs."position" (id) ON DELETE RESTRICT,

  -- Lo que Oranje le paga al colaborador en ese puesto.
  pay_rate  numeric(10,2) NOT NULL,
  -- Lo que el hotel le pagaria a Oranje. Nunca por debajo del pay.
  bill_rate numeric(10,2) NOT NULL,

  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6),

  CONSTRAINT ck_proposal_rate_positive CHECK (pay_rate > 0 AND bill_rate > 0),
  CONSTRAINT ck_proposal_rate_margin CHECK (bill_rate >= pay_rate)
);

-- ON DELETE CASCADE arriba y no RESTRICT como en el contrato: un borrador se
-- descarta entero (`discardDraft` borra la fila), y sus renglones no son
-- historia con el hotel mientras no se envie.

-- Un renglon por puesto: cotizar dos veces el mismo es un error de captura.
CREATE UNIQUE INDEX ux_proposal_rate_position
  ON commercial.proposal_rate (proposal_id, catalog_position_id);

CREATE INDEX ix_proposal_rate_proposal
  ON commercial.proposal_rate (proposal_id);
CREATE INDEX ix_proposal_rate_position
  ON commercial.proposal_rate (catalog_position_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON commercial.proposal_rate TO app_user;
