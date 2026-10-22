-- Campos del machote real del Service Agreement (Hugo, 2026-10-20): el
-- documento legal necesita el nombre de la propiedad, su dirección, el
-- correo del hotel, y el nombre/correo del Service Provider (hoy fijos en
-- código: "Orange Solutions & Operations, LLC" / irene@oranjepeople.com) como
-- datos editables, no constantes. Mismo criterio que los campos de Propuesta:
-- nullable, se prellenan pero son editables.
--
-- propertyAddress es UN solo campo (no street/city/state/zip por separado):
-- se prellena con el `cityState` de la última propuesta enviada, que ya
-- existe — separarlo habría exigido datos que Propuestas no captura.
ALTER TABLE commercial.contract ADD COLUMN property_name text;
ALTER TABLE commercial.contract ADD COLUMN property_address text;
ALTER TABLE commercial.contract ADD COLUMN company_email text;
ALTER TABLE commercial.contract ADD COLUMN service_provider_name text;
ALTER TABLE commercial.contract ADD COLUMN service_provider_email text;
