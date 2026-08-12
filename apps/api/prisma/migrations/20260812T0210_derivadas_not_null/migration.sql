-- Las dos columnas GENERATED se declaran NOT NULL.
--
-- Sus expresiones nunca pueden devolver NULL: `a IS NOT NULL OR b IS NOT NULL`
-- y el AND de nueve `IS NOT NULL` siempre dan true o false. Postgres no lo
-- deduce solo, asi que sin esto quedaban nulables y el datamodel no coincidia.
--
-- Nota: `DROP DEFAULT` NO se puede aplicar aqui. Postgres reporta la expresion de
-- generacion en el mismo lugar que un DEFAULT, pero no es uno — intentar quitarlo
-- da "column is a generated column". Es un falso positivo del diff de Prisma.

ALTER TABLE personal.worker
  ALTER COLUMN has_tax_id SET NOT NULL,
  ALTER COLUMN is_profile_complete SET NOT NULL;
