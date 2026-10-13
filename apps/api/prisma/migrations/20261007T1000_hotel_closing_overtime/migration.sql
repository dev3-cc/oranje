-- El hotel captura su fecha de cierre semanal y si paga horas extra, al darlo
-- de alta (paso "Datos contables"). El Contrato deja de pedirlo y lo hereda.
-- Decisión de Hugo, 2026-10-07.
-- Nullable: los hoteles que ya existen no tienen este dato capturado.

ALTER TABLE commercial.hotel
  ADD COLUMN week_start_day smallint,
  ADD COLUMN week_end_day smallint,
  ADD COLUMN overtime_pay_multiplier numeric(4,2);

ALTER TABLE commercial.hotel
  ADD CONSTRAINT ck_hotel_week_days CHECK (
    week_start_day IS NULL OR (week_start_day BETWEEN 0 AND 6 AND week_end_day BETWEEN 0 AND 6)
  ),
  ADD CONSTRAINT ck_hotel_overtime_multiplier CHECK (
    overtime_pay_multiplier IS NULL OR overtime_pay_multiplier IN (1.0, 1.5)
  );
