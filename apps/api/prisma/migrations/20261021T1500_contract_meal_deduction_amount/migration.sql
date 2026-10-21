-- "Comida" pasa de checkbox a input (Hugo, 2026-10-21): el monto ya no se
-- queda fijo en "$3 USD" en el texto del front, se guarda de verdad. 0 =
-- no se descuenta, mismo significado que deducts_meals = false.
ALTER TABLE commercial.contract
  ADD COLUMN meal_deduction_amount numeric(10, 2) NOT NULL DEFAULT 0;

-- Preserva lo que ya había: true se vuelve el monto que el texto prometía.
UPDATE commercial.contract
   SET meal_deduction_amount = 3.00
 WHERE deducts_meals = true;

ALTER TABLE commercial.contract DROP COLUMN deducts_meals;
