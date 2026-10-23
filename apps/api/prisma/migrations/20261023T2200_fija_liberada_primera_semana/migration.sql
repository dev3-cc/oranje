-- La fija liberada en su primera semana queda libre (Hugo, 2026-10-23).
-- Solo regresaban a Verde fuerte el Café y el Naranja: quien se liberaba en
-- Verde manzana (día 1) o Azul claro (día 3) se quedaba en ese color y no
-- volvía a salir como asignable. Se agregan los dos pasos, a nombre del
-- Sistema, como «Naranja → Verde fuerte».
--
-- Solo datos de catálogo: en una base recién creada (CI) los estados y el rol
-- todavía no están sembrados y esto toca cero filas; el seed ya los trae. Es
-- idempotente: si el paso ya existe, no se duplica.
INSERT INTO catalogs.status_light_transition (
  id, status_light_id, from_state_id, to_state_id, returns_to_previous,
  authorized_role_id, requires_reason, requires_evidence
)
SELECT gen_random_uuid(), sl.id, origen.id, destino.id, false, sys.id, false, false
FROM catalogs.status_light sl
JOIN catalogs.status_light_state origen
  ON origen.status_light_id = sl.id AND origen.code IN ('APPLE_GREEN', 'LIGHT_BLUE')
JOIN catalogs.status_light_state destino
  ON destino.status_light_id = sl.id AND destino.code = 'STRONG_GREEN'
CROSS JOIN identity.role sys
WHERE sl.code = 'WORKER' AND sys.code = 'ROL-SYS-01'
ON CONFLICT DO NOTHING;
