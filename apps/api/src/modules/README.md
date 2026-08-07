# Los 10 módulos

Estas diez carpetas son **todos** los módulos del backend. No se crea uno nuevo
por entidad ni por departamento del negocio: los departamentos del vault se
**mapean** a estos diez (**D-01**).

Cada carpeta es a la vez un módulo de NestJS y **un esquema de Postgres con el
mismo nombre**. `commercial/` escribe en `commercial.*`, y en ningún otro lugar.

---

## El nombre en el código y el nombre en el negocio

Los módulos van en **inglés** (**D-11**), pero el vault, la UI y las juntas
siguen en español. Esta tabla es el puente, y es la **única traducción
autorizada**: si un término no aparece aquí, no se traduce por criterio propio.

| Carpeta y esquema | Cómo se le dice en el negocio | Qué cubre                                                                |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------ |
| `identity`        | Identidad                     | Usuario · Rol · Matriz de Permisos                                       |
| `commercial`      | Comercial · Ventas            | Onboarding · Hotel · Contrato · tarifas por posición                     |
| `demand`          | Demanda                       | Requisición · Posición · Slot · Urgencia                                 |
| `coverage`        | Cobertura                     | Self-Pick · Asignación · Blacklist · Pool · expediente del Colaborador   |
| `operations`      | Operación                     | Schedule · Timesheet · Ponche                                            |
| `settlement`      | **Liquidación**               | Consolidado · Deducciones · Factura · Vacaciones                         |
| `supervision`     | Supervisión                   | Inspección · Accidente Laboral · QA · Customer Service                   |
| `journal`         | Bitácora                      | Append-only (RR-16) + auditoría de acceso a PII                          |
| `notifications`   | Notificaciones                | Push · emails · consumidor de eventos                                    |
| `catalogs`        | Catálogos                     | Posiciones · Zonas · Niveles de Inglés · Departamentos · los 7 semáforos |

Cuatro apenas cambian —`identity`, `commercial`, `supervision`, `journal`— y las
otras seis son traducción directa. **La que hay que aprender es `settlement` =
Liquidación**: no es "settlement" en el sentido de acuerdo, es el módulo donde se
consolida lo que se paga y lo que se factura.

> [!]
> Esta tabla traduce **módulos**. El glosario de las **entidades** (Colaborador →
> `Worker`, Requisición → `Requisition`, Ponche → `PunchMark`…) está en
> `Estructura de Proyecto y Nomenclatura` §8, y también es obligatorio: quien
> agrega un concepto agrega su fila en el mismo PR.

---

## Las dos reglas que rigen aquí

**1. Un módulo no consulta las tablas de otro.** Lo que necesite se lo pide al
`index.ts` del otro módulo. Nunca un `SELECT` cruzado, ni siquiera cuando es más
rápido.

> Ejemplo real: `settlement` necesita las horas pagables, que viven en
> `operations.punch_mark`. **No las lee.** Se las pide a `operations`. Si el
> filtro por `approved` se escribiera en dos módulos, en el primer cambio de la
> máquina de estados uno pagaría lo que el otro no.

Las llaves foráneas **sí** cruzan esquemas: la integridad referencial no se
negocia por respetar una frontera de código. Lo que no cruza son las consultas.

**2. `demand → coverage → operations` no se separan.** Esos tres corren en una
sola transacción de Postgres: ocupar el slot, recalcular la cobertura,
recalcular el estado de la requisición, escribir el journal y generar el
Schedule. Esa unión es una regla de negocio (**RR-15**), no un detalle de
implementación.

Los únicos candidatos a extraerse algún día son `notifications` y
`supervision`, porque ninguno participa en esa transacción.

---

## Qué hace cada uno

### `identity`

Usuarios, roles y la Matriz de Permisos. Verifica el token del proveedor de
identidad.

Autorizar tiene dos preguntas y las separa: **la capacidad** vive en
`role_permission` (`role_id`, `module`, `action`), y **el alcance** vive en la
persona (`user.hotel_id` + `user.department_id`).

> `department_id` nulo no significa "sin permiso": significa **todos los
> departamentos de mi hotel**. Es lo que distingue al Manager General del
> Manager de Área sin una tabla de excepciones.

Nunca columnas booleanas de permiso en la tabla de usuario. Con 16 roles y 9
módulos por departamento, ese diseño obliga a migrar y desplegar por cada
cambio.

### `commercial`

El ciclo comercial del hotel: Onboarding, el Hotel, el Contrato y las tarifas
por posición.

`hotel` guarda solo lo permanente del edificio. El **ciclo comercial** es su
propia entidad, `prospect`, y ahí vive el Semáforo Onboarding — porque un hotel
se prospecta más de una vez y el segundo intento no debe pisar la historia del
primero (**D-13**).

Un hotel no puede tener dos ciclos abiertos a la vez, y eso lo garantiza un
índice único parcial, no el código.

### `demand`

La Requisición, sus Posiciones, los Slots y la Urgencia.

El **slot** es la unidad de bloqueo: una fila por cada persona solicitada. Es lo
que permite cumplir RR-15 sin Redis, bloqueando la fila del slot y no la
requisición.

La urgencia **no se guarda como verdad**: se recalcula sobre la fecha de
autorización contra la fecha de inicio.

### `coverage`

Self-Pick (Participación), Asignación, Blacklist, Pool de Colaboradores y el
expediente del Colaborador.

El Colaborador **no tiene hotel**: el vínculo es siempre vía `assignment`, que
tiene fechas. Eso resuelve de una sola vez el Pool, el trabajo multi-hotel en
una semana y el histórico.

RR-05 —un colaborador no puede tener dos asignaciones activas solapadas— se hace
cumplir con una **restricción de exclusión** de Postgres, no con lógica de
aplicación.

> **Hueco abierto:** D-01 no le asigna módulo al expediente del Colaborador ni
> al flujo de Reclutamiento. Están aquí provisionalmente; la alternativa es un
> módulo `personal/` propio, y entonces serían 11. Resolver antes de la primera
> migración.

### `operations`

Schedule, Timesheet y el Ponche: GPS, foto y geocerca. Más el estado y la
aprobación de cada marca.

**El servidor decide, el teléfono no** (**D-08**). La app manda coordenadas
crudas y el backend evalúa la geocerca. Si la app enviara "estoy dentro", el
control no existiría.

Se guardan **las dos horas**: la del dispositivo y la del servidor. Una
diferencia anómala entre ambas es señal de revisión, no un error.

### `settlement`

Consolidado, Deducciones, Factura y Vacaciones. Aquí vive el margen.

El detalle del consolidado se rompe **por requisición**, no por hotel: el umbral
de 40 horas se evalúa sobre cada fila por separado, y las horas de requisiciones
distintas no se suman para decidir overtime (**D-10**).

> `pay_rate` nunca aparece en la factura. `bill_rate` nunca aparece en el recibo
> del colaborador. Son dos consultas distintas sobre el mismo timesheet — y esa
> separación es el negocio.

### `supervision`

Inspección, Accidente Laboral, QA y Customer Service.

QA **observa, mide y retroalimenta**; no ejecuta la operación de ningún
departamento.

### `journal`

La bitácora append-only (**RR-16**) y la auditoría de acceso a datos personales.

Es inmutable de verdad, no por convención: `REVOKE UPDATE, DELETE` sobre la
tabla para el usuario de la aplicación.

Va **particionada por mes desde la primera migración**. No por volumen, sino por
forma: retrofitear la partición exige reescribir la tabla con la aplicación
detenida.

> El journal es auditoría del sistema, **no** una tabla para consultas de
> negocio. "¿Cuánto tiempo estuvo este hotel en Amarillo?" se contesta con la
> tabla de historia del semáforo, no recorriendo `jsonb` de una tabla
> particionada con retención de 24 meses (**D-14**).

### `notifications`

Consumidor de eventos: push, emails y avisos.

Vive **fuera del núcleo transaccional** (**D-03**). Meter el núcleo en un bus lo
volvería de consistencia eventual, y entonces "gana el primero" dejaría de
cumplirse.

### `catalogs`

Posiciones, Zonas, Niveles de Inglés, Departamentos del Hotel, Modalidades de
Contratación — y **los 7 semáforos como datos**.

Los semáforos no se codifican: se configuran. Tres tablas —
`status_light`, `status_light_state`, `status_light_transition` — y con eso
_"solo el BDC aprueba la conversión"_ es **una fila, no un `if`**.

> Añadir un estado o cambiar quién autoriza una transición es un `INSERT`, no un
> despliegue. Esa es la razón de ser de este módulo.

---

## El corte entre operación y dinero es un estado, no un módulo

`operations` guarda la marca con su estado (`pending → reviewed → approved` |
`rejected`). `settlement` solo cuenta horas de marcas en `approved`.

**Solo el ponche aprobado paga** (**D-09**). Una marca `pending` existe, se ve en
el calendario y no vale dinero.

---

## Antes de tocar cualquiera de estas carpetas

El código **nunca** es la fuente de verdad del negocio. Si necesitas una regla
que la documentación no tiene, la respuesta no es inventarla en un `if`: se
documenta primero en el vault.

| Dónde                                                              | Qué encuentras                              |
| ------------------------------------------------------------------ | ------------------------------------------- |
| `Core/Módulos/Reglas de Negocio`                                   | La fuente de verdad. Ante conflicto, gana   |
| `Arquitecturas/_Globales/Decisiones de Arquitectura`               | D-01 … D-15 con su justificación            |
| `Arquitecturas/_Globales/Modelo de Datos`                          | Entidades, relaciones e invariantes         |
| `Arquitecturas/_Globales/Estándares de Base de Datos`              | Nomenclatura, tipos, restricciones, índices |
| `Arquitecturas/_Globales/Estructura de Proyecto y Nomenclatura` §3 | El mapa completo departamento → módulo      |
