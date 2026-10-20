-- El machote aprobado de la propuesta (ORANJE_PEOPLE_Staffing_Proposal_Template,
-- Hugo 2026-10-19) trae campos que hoy no existen en ningún lado del sistema:
-- marca/administradora del hotel, ciudad y estado, a quién va dirigida la
-- carta, y el teléfono/correo de quien la envía (hoy fijos a Irene en el
-- generador — no todos los BD firman con su mismo contacto). Van en la
-- propuesta, no en el Hotel ni en el Usuario: se llenan cada vez que se arma
-- una versión, como ya pasa con `title`/`services_note`. Todos nullable: las
-- versiones que ya existen no los tienen y no se inventan.

ALTER TABLE commercial.proposal
  ADD COLUMN brand_management_company text,
  ADD COLUMN city_state text,
  ADD COLUMN contact_name text,
  ADD COLUMN sender_phone text,
  ADD COLUMN sender_email text;
