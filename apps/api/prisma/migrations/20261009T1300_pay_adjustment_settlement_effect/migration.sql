-- El gasto de una asignación eventual (p. ej. Uber) no siempre lo paga el
-- colaborador de su bolsillo: a veces lo manda Oranje directo, y a veces
-- Oranje lo paga pero se lo descuenta al colaborador después, a petición
-- suya (Hugo, 2026-10-09). Hasta hoy el monto aprobado no decía nada de
-- esto, así que Contabilidad no tenía de dónde saber si debía sumarle algo
-- al colaborador, restarle algo, o no tocar su pago en absoluto.
--
-- Solo aplica al GASTO (pay_concept_id con valor): el ajuste de tarifa llano
-- no tiene de quién reembolsar o descontar, pisa la tarifa y ya.

ALTER TABLE coverage.assignment_pay_adjustment
  ADD COLUMN settlement_effect text;

ALTER TABLE coverage.assignment_pay_adjustment
  ADD CONSTRAINT ck_assignment_pay_adjustment_settlement_effect CHECK (
    (pay_concept_id IS NULL AND settlement_effect IS NULL)
    OR (
      pay_concept_id IS NOT NULL
      AND settlement_effect IN ('REIMBURSE', 'COMPANY_EXPENSE', 'PAYROLL_DEDUCTION')
    )
  );
