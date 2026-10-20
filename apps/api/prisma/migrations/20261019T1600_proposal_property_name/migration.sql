-- [PROPERTY NAME] también está marcado azul/editable en el machote aprobado
-- (Hugo, 2026-10-19): el hotel puede operar bajo otro nombre comercial en el
-- documento que el que tiene en el sistema ("Río Bravo" vs. el nombre legal
-- de la propiedad). Mismo criterio que los otros 5 campos del machote:
-- nullable, se prellena con el nombre del hotel pero es editable.

ALTER TABLE commercial.proposal
  ADD COLUMN property_name text;
