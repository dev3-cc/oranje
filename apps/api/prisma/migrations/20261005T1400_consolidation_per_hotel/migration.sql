-- El consolidado pasa a ser por colaborador, hotel y semana (P-CO-12, decisión de Hugo 2026-10-05):
-- quien trabaja en dos hoteles la misma semana recibe dos pagos.
-- Producción y desarrollo tienen cero consolidados al momento de escribir esto: no hay datos que migrar.
-- Si esta migración se aplica después de que existan consolidados, NOT NULL fallará; en ese caso
-- hay que rellenar hotel_id desde consolidation_detail antes.

DROP INDEX settlement.ux_consolidation_worker_week;

ALTER TABLE settlement.consolidation
  ADD COLUMN hotel_id uuid NOT NULL
  REFERENCES commercial.hotel (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX ux_consolidation_worker_hotel_week
  ON settlement.consolidation (worker_id, hotel_id, week_start);

CREATE INDEX ix_consolidation_hotel
  ON settlement.consolidation (hotel_id);
