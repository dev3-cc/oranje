-- Conceptos de pago extra (rate interno): catálogo del Administrador.
-- Decisión de Hugo (2026-10-05, P-CO-07).
CREATE TABLE catalogs.pay_concept (
  id         uuid PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- NULO = tarifa interna normal, como hasta hoy.
ALTER TABLE personal.worker_rate
  ADD COLUMN pay_concept_id uuid NULL
  REFERENCES catalogs.pay_concept (id) ON DELETE RESTRICT;

-- Un colaborador puede tener una tarifa general y otra por concepto vigentes a la vez.
-- Mismo nombre que antes: schema-guards depende de él.
DROP INDEX personal.ux_worker_rate_active;
CREATE UNIQUE INDEX ux_worker_rate_active
  ON personal.worker_rate (worker_id, catalog_position_id, pay_concept_id)
  NULLS NOT DISTINCT
  WHERE valid_to IS NULL;
