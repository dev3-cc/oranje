# Módulo `commercial`

Uno de los 10 módulos de **D-01**. Su esquema de Postgres se llama igual.

**Frontera:** este módulo no consulta las tablas de otro. Lo que necesite de
otro módulo lo pide por su `index.ts`, nunca con un `SELECT` cruzado
(Estándares de Base de Datos §1).

Qué cubre del vault: ver el mapa de módulos en
`Estructura de Proyecto y Nomenclatura` §3.

## Submódulos y sus tablas

El modelo vigente es `Ventas - Modelo de Datos v2.drawio` del vault. Ninguna
tabla entra aquí sin estar en ese diagrama.

| Submódulo      | Tablas                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| `hotels/`      | `hotel` · `hotel_contact` · vista `vw_client`                          |
| `onboarding/`  | `prospect` · `prospect_state_history` · `contact_attempt` · `proposal` |
| `territories/` | `user_zone`                                                            |

Falta del mapa de §3: `contract` y las tarifas por posición, que llegan con su
propio diagrama.

## Lo que no se puede declarar como restricción

Cruzan filas o tablas, así que viven en el servicio de transición del pipeline,
dentro de la transacción:

- **RR-V-09** — la propuesta solo se elabora en `GREEN`.
- **RR-V-02** — debe existir el Usuario del Hotel antes de pasar a `ORANGE`.
- **RR-V-01** — solo el BDC aprueba la conversión. Se **lee** de
  `catalogs.status_light_transition.authorized_role_id`; no se codifica.

El servicio, en una transacción: lee la transición (si no existe → `409`),
verifica el rol (`403`), exige motivo si `requires_reason` (`422`), actualiza
`prospect.onboarding_state_id`, inserta en `prospect_state_history` y escribe en
`journal`.

Trece RF de Ventas (RF-V-07 a RF-V-21) son ese mismo servicio con distintos
parámetros. No son trece endpoints con lógica propia.
