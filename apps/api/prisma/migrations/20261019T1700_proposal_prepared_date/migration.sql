-- "Prepared [DATE]" del machote también se vuelve editable (Hugo, 2026-10-19):
-- mismo criterio que los otros 6 campos — nullable, el front la prellena con
-- la fecha de hoy pero se puede escribir otra.

ALTER TABLE commercial.proposal
  ADD COLUMN prepared_date text;
