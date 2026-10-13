-- Corrección: "Regular" significa que las horas que pasan de 40 NO se pagan
-- (multiplicador 0), no que se pagan igual que la hora normal (1.0).
-- Decisión de Hugo, 2026-10-07. Los 32 hoteles existentes tienen NULL en este
-- campo (nadie lo había capturado todavía): no hay datos que corregir.

ALTER TABLE commercial.hotel
  DROP CONSTRAINT ck_hotel_overtime_multiplier;

ALTER TABLE commercial.hotel
  ADD CONSTRAINT ck_hotel_overtime_multiplier CHECK (
    overtime_pay_multiplier IS NULL OR overtime_pay_multiplier IN (0, 1.5)
  );
