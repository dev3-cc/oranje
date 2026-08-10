# Módulo `catalogs`

Uno de los 10 módulos de **D-01**. Su esquema de Postgres se llama igual.

**Frontera:** este módulo no consulta las tablas de otro. Lo que necesite de
otro módulo lo pide por su `index.ts`, nunca con un `SELECT` cruzado
(Estándares de Base de Datos §1).

Qué cubre del vault: ver el mapa de módulos en
`Estructura de Proyecto y Nomenclatura` §3.

## Submódulos y sus tablas

| Submódulo            | Tablas                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `status-lights/`     | `status_light` · `status_light_state` · `status_light_transition` · `status_change_reason` |
| `zones/`             | `zone`                                                                                     |
| `hotel-departments/` | `hotel_department`                                                                         |

Faltan Posiciones, Niveles de Inglés y Modalidades de Contratación: se quitaron
el 2026-08-10 porque no están en el diagrama de Ventas. Vuelven con el diagrama
de su departamento.

## Los semáforos se configuran, no se codifican

Los 7 semáforos son **filas**, no enums. Añadir un estado o cambiar quién
autoriza una transición es un `INSERT`, no un despliegue — y _"solo el BDC
aprueba la conversión"_ es una fila de `status_light_transition`, no un `if`.

Hoy las tablas están **vacías**: `prisma/seed.ts` sigue pendiente. Sin estados
ni transiciones sembrados, cualquier transición devuelve `409`.
