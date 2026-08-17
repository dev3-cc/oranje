# Módulo `coverage`

Uno de los 10 módulos de **D-01**. Su esquema de Postgres se llama igual.

**Frontera:** este módulo no consulta las tablas de otro. Lo que necesite de
otro módulo lo pide por su `index.ts`, nunca con un `SELECT` cruzado
(Estándares de Base de Datos §1).

Qué cubre del vault: ver el mapa de módulos en
`Estructura de Proyecto y Nomenclatura` §3.
