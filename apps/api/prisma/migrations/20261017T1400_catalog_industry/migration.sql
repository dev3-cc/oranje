-- Industria: nueva tabla (Hugo, 2026-10-17). Oranje deja de ser solo hoteles
-- —Warehouse, Retail, IT…— y una posición de esas industrias no tiene
-- departamento de hotel, así que esa columna pasa a opcional. El departamento
-- de la REQUISICIÓN (demand.position) no se toca: sigue siendo el alcance
-- real de permisos del Supervisor/Manager de Área.

CREATE TABLE catalogs.industry (
  id         uuid PRIMARY KEY,
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE catalogs.position
  ADD COLUMN industry_id uuid REFERENCES catalogs.industry(id) ON DELETE RESTRICT,
  ALTER COLUMN hotel_department_id DROP NOT NULL;

CREATE INDEX ix_position_industry ON catalogs.position (industry_id);
