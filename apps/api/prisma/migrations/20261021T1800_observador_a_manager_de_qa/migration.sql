-- El Observador se convierte en Manager de QA (Hugo, 2026-10-21): su pantalla
-- y su lectura transversal pasan al Manager de QA (ROL-Q-02) y el rol
-- ROL-OBS-01 deja de existir. Quien era Observador queda como Manager de QA.
--
-- Solo mueve datos: en una base recién creada (CI) los roles todavía no están
-- sembrados y todo esto toca cero filas; el seed ya trae los permisos en el
-- Manager de QA. Es idempotente: si el Observador ya no existe, no hace nada.

-- 1. Sus permisos, al Manager de QA (los que ya tuviera no se duplican).
INSERT INTO identity.role_permission (id, role_id, module, action)
SELECT gen_random_uuid(), qa.id, rp.module, rp.action
FROM identity.role_permission rp
JOIN identity.role obs ON obs.id = rp.role_id AND obs.code = 'ROL-OBS-01'
CROSS JOIN identity.role qa
WHERE qa.code = 'ROL-Q-02'
ON CONFLICT DO NOTHING;

-- 2. Sus transiciones de semáforo, si tuviera alguna (hoy ninguna: es de lectura).
INSERT INTO catalogs.status_light_transition (
  id, status_light_id, from_state_id, to_state_id, returns_to_previous,
  authorized_role_id, requires_reason, requires_evidence
)
SELECT gen_random_uuid(), t.status_light_id, t.from_state_id, t.to_state_id,
  t.returns_to_previous, qa.id, t.requires_reason, t.requires_evidence
FROM catalogs.status_light_transition t
JOIN identity.role obs ON obs.id = t.authorized_role_id AND obs.code = 'ROL-OBS-01'
CROSS JOIN identity.role qa
WHERE qa.code = 'ROL-Q-02'
ON CONFLICT DO NOTHING;

-- 3. Sus personas pasan a ser Manager de QA.
UPDATE identity."user" u
SET role_id = qa.id, updated_at = now()
FROM identity.role obs, identity.role qa
WHERE u.role_id = obs.id AND obs.code = 'ROL-OBS-01' AND qa.code = 'ROL-Q-02';

-- 4. El rol queda vacío y se borra.
DELETE FROM catalogs.status_light_transition t
USING identity.role obs
WHERE t.authorized_role_id = obs.id AND obs.code = 'ROL-OBS-01';

DELETE FROM identity.role_permission rp
USING identity.role obs
WHERE rp.role_id = obs.id AND obs.code = 'ROL-OBS-01';

DELETE FROM identity.role WHERE code = 'ROL-OBS-01';
