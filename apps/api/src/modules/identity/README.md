# Módulo `identity`

Uno de los 10 módulos de **D-01**. Su esquema de Postgres se llama igual.

**Frontera:** este módulo no consulta las tablas de otro. Lo que necesite de
otro módulo lo pide por su `index.ts`, nunca con un `SELECT` cruzado
(Estándares de Base de Datos §1).

Qué cubre del vault: ver el mapa de módulos en
`Estructura de Proyecto y Nomenclatura` §3.

## Submódulos y sus tablas

| Submódulo | Tablas                     |
| --------- | -------------------------- |
| `users/`  | `user`                     |
| `roles/`  | `role` · `role_permission` |

## Autorizar tiene dos preguntas

**La capacidad** vive en `role_permission` (`role_id`, `module`, `action`): es la
Matriz de Permisos pura, por rol.

**El alcance** vive en la persona: `user.hotel_id` + `user.department_id`. Un
`department_id` nulo no significa "sin permiso", significa **todos los
departamentos de mi hotel** — y eso es lo que separa al Manager General del
Manager de Área sin una tabla de excepciones.

Si el alcance viviera en el permiso, haría falta una fila por hotel × depto ×
acción.
