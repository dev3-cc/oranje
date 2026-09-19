---
tags:
  - arquitectura
  - global
  - ingenieria
aliases:
  - Estándares de Base de Datos
  - Convenciones de Postgres
  - Estándares de BD
---

# Estándares de Base de Datos

Reglas de diseño, evolución y operación del esquema Postgres de Oranje. Es el documento que debe leer cualquier persona antes de escribir su primera migración.

> [!info]
> **Alcance:** el _cómo_ del esquema — tipos, nombres, restricciones, índices, migraciones y crecimiento. El _qué_ —las entidades y las reglas que hacen cumplir— vive en [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]]. La topología de módulos y esquemas, en [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]] D-01.

> [!important] Principio rector
> **Toda regla que pueda vivir como restricción de base de datos, vive ahí.** Una regla en el código se puede saltar con un script, un job o un endpoint nuevo; una restricción, no. El catálogo de invariantes que este principio produce está en [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]] §10.

---

## 1. Organización del esquema

**Un esquema Postgres por módulo de negocio** (D-01). No hay `public`.

```
identity · commercial · demand · coverage · operations
settlement · supervision · journal · notifications · catalogs
```

| Regla                                    | Detalle                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Un módulo no consulta las tablas de otro | `demand` no hace `SELECT` sobre `settlement.invoice`. Pide por la interfaz pública del módulo |
| Las FK entre esquemas **sí existen**     | La integridad referencial no se negocia por respetar una frontera de código                   |
| `public` queda vacío                     | Salvo extensiones (`postgis`, `pgcrypto`, `btree_gist`)                                       |
| Sin `search_path` implícito              | Toda referencia va calificada: `demand.requisition`, nunca `requisition`                      |

> [!note]
> Las FK cruzan esquemas y las consultas no. Suena contradictorio y no lo es: la FK la hace cumplir el motor sin que ningún módulo dependa del otro en código, y es lo que permite separar un módulo algún día sin haber acumulado datos huérfanos mientras tanto.

---

## 2. Nomenclatura

| Objeto            | Convención                           | Ejemplo                             |
| ----------------- | ------------------------------------ | ----------------------------------- |
| Esquema           | Nombre del módulo de D-01, en inglés | `demand`                            |
| Tabla             | `snake_case` **singular**            | `demand.requisition`                |
| Columna           | `snake_case`                         | `authorized_at`                     |
| Clave primaria    | `id`                                 | —                                   |
| Clave foránea     | `<entidad>_id`                       | `requisition_id`, `hotel_id`        |
| Booleano          | Prefijo `is_` / `has_`               | `is_active`, `has_transport`        |
| Fecha/hora        | Sufijo `_at`                         | `created_at`, `authorized_at`       |
| Índice            | `ix_<tabla>_<columnas>`              | `ix_punch_mark_timesheet_work_date` |
| Índice único      | `ux_<tabla>_<columnas>`              | `ux_slot_active_assignment`         |
| Restricción CHECK | `ck_<tabla>_<regla>`                 | `ck_punch_mark_photo_required`      |
| Clave foránea     | `fk_<tabla>_<tabla_destino>`         | `fk_position_requisition`           |
| Vista             | `vw_<nombre>`                        | `vw_worker_pool`                    |
| Enum de dominio   | **No se usa** — ver §5               | —                                   |

**Sin acentos ni eñes** en ningún identificador de base de datos. Los acentos viven en los textos de la UI, no en el esquema.

> [!important] Todo el identificador en inglés
> **Desde el 2026-08-07 no hay excepciones de idioma en la base de datos.** El esquema, la tabla y la columna van en inglés; los nombres en español viven en el vault y en la UI, nunca en un identificador.
>
> Los diez esquemas conservan el **significado** de los módulos de D-01, traducido: `demanda → demand`, `cobertura → coverage`, `operacion → operations`, `liquidacion → settlement`, `notificaciones → notifications`, `catalogos → catalogs`. `identity`, `commercial`, `supervision` y `journal` casi no cambian.
>
> El prefijo sigue diciendo **en qué módulo estás** y la tabla **qué guarda**. Lo que se fue es tener que recordar qué parte del identificador tocaba en cada idioma.

> [!warning]
> La tabla va en **singular** y el endpoint en **plural** (`GET /api/v1/requisitions`). No es incoherencia: la tabla nombra una fila y ya viene calificada por su esquema; el endpoint nombra una colección. Ver [[Estructura de Proyecto y Nomenclatura]] §7.

---

## 3. Tipos de datos canónicos

Un concepto, un tipo. Estas equivalencias no se eligen por tabla.

| Concepto               | Tipo                               | Por qué                                                                                              |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Identificador          | `uuid` (v7)                        | Ordenable por tiempo — un v4 fragmenta el índice primario en cada inserción                          |
| Texto libre            | `text`                             | `varchar(n)` no da rendimiento en Postgres; el límite se valida con `CHECK` cuando es una regla real |
| Dinero                 | `numeric(12,2)`                    | **Nunca `float`.** Un `double precision` no representa 0.1                                           |
| Tarifa (pay/bill rate) | `numeric(10,4)`                    | El decimal extra evita arrastre al multiplicar por horas                                             |
| Duración               | `integer` en **minutos**           | 37.5 h son 2250 minutos exactos. Con horas decimales el error se acumula por jornada                 |
| Fecha y hora           | `timestamptz`                      | **Nunca `timestamp`** — ver §11                                                                      |
| Fecha sin hora         | `date`                             | Jornada, semana de nómina                                                                            |
| Rango de vigencia      | `daterange`                        | Lo exige la restricción de exclusión de RR-05                                                        |
| Coordenada / perímetro | `geography(Point,4326)`            | PostGIS. La geocerca del hotel (D-08)                                                                |
| Estructura variable    | `jsonb`                            | Solo para el `payload` del journal. No para datos consultables                                       |
| Estado de semáforo     | FK a `catalogs.status_light_state` | Ver §5                                                                                               |

> [!important] Cálculo de dinero
> Toda operación aritmética sobre montos se hace en `numeric`, dentro de la base de datos o en un tipo decimal de la aplicación — **nunca en el `number` de JavaScript**. El redondeo se aplica **una sola vez**, al final del cálculo, no en cada paso intermedio. Redondear por jornada y volver a redondear por semana produce centavos de diferencia contra lo que el colaborador espera cobrar.

---

## 4. Columnas obligatorias

Toda tabla de negocio lleva:

| Columna      | Tipo          | Nota                                                        |
| ------------ | ------------- | ----------------------------------------------------------- |
| `id`         | `uuid`        | PK, generado por la aplicación (v7) — ver el aviso de abajo |
| `created_at` | `timestamptz` | `DEFAULT now()`                                             |
| `updated_at` | `timestamptz` | Mantenido por trigger, no por la aplicación                 |

> [!warning] El `id` no lo genera Postgres
> **No hay `DEFAULT` en la PK.** Ninguna función del motor produce un uuid v7: `gen_random_uuid()` —de `pgcrypto`, o nativa desde Postgres 13— devuelve **v4**, que es aleatorio y fragmenta el índice primario en cada inserción. Eso es justo lo que la §3 evita al pedir v7.
>
> El v7 lo genera la aplicación con una librería, antes del `INSERT`. Es lo que además permite conocer el `id` sin ida y vuelta a la base, que es lo que hace posible armar un grafo de objetos completo dentro de una sola transacción.
>
> **`pgcrypto` está en el esquema por otra razón:** el cifrado de campo de SSN e ITIN (§12). No por las llaves.

Y donde el negocio identifica a un responsable:

| Columna                    | Nota                 |
| -------------------------- | -------------------- |
| `created_by`, `updated_by` | FK a `identity.user` |

**Excepciones deliberadas:** `journal` no lleva `updated_at` ni `updated_by` — es append-only y no se toca (RR-16). Las tablas de catálogo sembradas no llevan autoría.

### Borrado

El borrado lógico **no es el comportamiento por defecto**: se agrega `deleted_at` solo donde el negocio necesita recuperar o auditar lo eliminado.

| Entidad                                          | Política                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `worker`, `requisition`, `timesheet`, `contract` | `deleted_at` — nunca `DELETE` físico                                                      |
| `blacklist_entry`, `journal`                     | **Ni físico ni lógico.** El veto es permanente (RR-03) y la bitácora es inmutable (RR-16) |
| Catálogos, tablas puente                         | `DELETE` físico si no hay referencias                                                     |

> [!warning]
> Con borrado lógico, **todo índice único debe ser parcial**:
>
> ```sql
> CREATE UNIQUE INDEX ux_worker_numero
>   ON coverage.worker (numero) WHERE deleted_at IS NULL;
> ```
>
> Un `UNIQUE` normal sobre una tabla con `deleted_at` bloquea reutilizar el número de un registro eliminado. Es el error más común de este patrón y aparece meses después, en producción.

---

## 5. Los semáforos no son enums nativos

**Decisión:** los 7 semáforos se modelan como **tablas de catálogo** (`catalogs.status_light`, `status_light_state`, `status_light_transition`), no como `CREATE TYPE ... AS ENUM`.

| Razón                                                         | Detalle                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Añadir un estado no debe requerir desplegar                   | Es un `INSERT`. Con enum nativo es una migración                                                                       |
| `ALTER TYPE ... ADD VALUE` no corre dentro de una transacción | Rompe el patrón de migración atómica                                                                                   |
| Un valor de enum **no se puede eliminar**                     | Solo se puede recrear el tipo entero y reescribir cada columna que lo use                                              |
| Las transiciones son datos                                    | `status_light_transition` guarda quién puede pasar de qué a qué, con motivo y evidencia. Un enum no puede expresar eso |
| Un color significa cosas distintas por semáforo               | `status_light_state` está calificado por `status_light_id`; un enum global no lo estaría                               |

> [!warning] Corrige el estándar anterior
> [[Estándares de Desarrollo]] §5 decía _"enum nativo de Postgres para los semáforos"_. Contradecía [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]] §4. **Manda esta sección.**

Los enums nativos sí son válidos para conjuntos **cerrados y técnicos** que solo cambian con un despliegue: `type` del ponche (`CLOCK_IN`/`LUNCH`/`CLOCK_OUT`), `source` (`mobile`/`manual`). Si el negocio puede querer agregar un valor sin avisar, es tabla.

### La tercera opción: `text` con `CHECK`

Entre el enum nativo y la tabla de catálogo hay un punto medio que es el correcto la mayoría de las veces:

```sql
attempt_type text NOT NULL
ck_contact_attempt_type
  CHECK (attempt_type IN ('COLD_VISIT', 'CALL', 'EMAIL'))
```

Da la misma garantía que el catálogo —la base rechaza cualquier otro valor, así que `GROUP BY` funciona y el reporte es posible— sin una tabla, una FK y un join en cada consulta. Y a diferencia del enum nativo, agregar un valor es una migración normal dentro de una transacción.

**El criterio que decide, y no es "cuántos valores hay":**

| Es tabla de catálogo                                                               | Es `text` con `CHECK`                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Existe (o va a existir) una **pantalla** donde alguien del negocio agrega un valor | El valor solo cambia cuando Ingeniería despliega |
| El valor lleva datos propios: color, orden de despliegue, rol autorizado           | El valor es solo el valor                        |
| Otras tablas necesitan apuntarle con FK                                            | Nadie le apunta                                  |

La pregunta operativa es **quién agrega el valor**. Si es el negocio sin pedir permiso, es tabla; si es un PR, es `CHECK`. Un catálogo que solo Ingeniería alimenta es una tabla y un join a cambio de nada.

> [!note]
> El camino de vuelta es aditivo y no se pierde nada: se crea la tabla, se siembra con los valores del `CHECK`, y la columna pasa a FK. Empezar con `CHECK` no cierra la puerta.

---

## 6. Claves, relaciones y restricciones

### Claves foráneas

- Toda relación se declara como FK. Sin excepciones por rendimiento.
- **`ON DELETE RESTRICT` por defecto.** `CASCADE` solo en composición pura, donde el hijo no tiene sentido sin el padre: `position → slot`.
- Nunca `ON DELETE SET NULL` sobre una columna que participa en un cálculo de dinero.

### Restricciones

| Tipo                 | Cuándo                                                        |
| -------------------- | ------------------------------------------------------------- |
| `NOT NULL`           | Por defecto. Nullable es la excepción y se justifica          |
| `CHECK`              | Toda regla expresable sobre la propia fila                    |
| `UNIQUE` parcial     | Unicidad condicionada por estado (§4)                         |
| `EXCLUDE USING gist` | Solapamiento temporal — RR-05                                 |
| Trigger              | Último recurso, solo cuando la regla necesita ver otras filas |

Los triggers son el mecanismo más difícil de depurar del esquema: no aparecen en el código de la aplicación y se ejecutan sin que nadie los llame. Se usan para reglas que ningún `CHECK` puede expresar, y cada uno lleva un comentario con el ID de la regla que implementa.

```sql
COMMENT ON TRIGGER tg_requisition_exige_positions ON demand.requisition
  IS 'RR-H-03: no se autoriza una requisición sin al menos una posición';
```

---

## 7. Índices

| Regla                                            | Detalle                                                      |
| ------------------------------------------------ | ------------------------------------------------------------ |
| Toda FK va indexada                              | Postgres **no** los crea solos, a diferencia de MySQL        |
| Toda columna de filtro frecuente va indexada     | `status_light_state_id`, `zone_id`, `hotel_id`               |
| Índices parciales para estados calientes         | `WHERE status = 'pending'` — más pequeño y más rápido        |
| Índice compuesto: primero la columna de igualdad | `(timesheet_id, work_date)`, no al revés                     |
| En producción, `CREATE INDEX CONCURRENTLY`       | Un `CREATE INDEX` normal bloquea escrituras en toda la tabla |

**Cuándo no indexar:** columnas de baja cardinalidad sin filtro real, tablas de menos de unos miles de filas, y cualquier índice que nadie pueda justificar con una consulta concreta. Cada índice se paga en cada `INSERT` y en cada `UPDATE`.

> [!note]
> Un PR que agrega un índice explica **qué consulta lo necesita**. Un PR que agrega una consulta sobre una tabla grande adjunta su `EXPLAIN (ANALYZE, BUFFERS)`.

---

## 8. Migraciones

Toda migración se genera con `prisma migrate dev`, se commitea y se revisa. **El esquema de producción nunca se edita a mano.**

| Regla                           | Detalle                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Una migración por PR            | Con nombre descriptivo: `20260805_agrega_geofence_hotel`                            |
| Reversible                      | Toda migración se puede deshacer, o el PR explica por qué no                        |
| Sin pérdida de datos silenciosa | Un `DROP COLUMN` en el mismo PR que lo dejó de usar es un despliegue roto esperando |
| Datos semilla versionados       | Catálogos en `prisma/seed.ts`                                                       |

### Cambios destructivos: expandir y contraer

Nunca en un solo despliegue. Cuatro pasos, en este orden:

1. **Expandir** — agregar la columna nueva, nullable, sin tocar la vieja.
2. **Escribir en ambas** — desplegar el código que llena las dos. Backfill de lo histórico.
3. **Leer de la nueva** — desplegar el código que ya no lee la vieja. Verificar en producción.
4. **Contraer** — eliminar la columna vieja, en un despliegue posterior.

Entre el paso 3 y el 4 debe pasar al menos un ciclo completo de nómina. Si algo quedó leyendo la columna vieja, ahí aparece.

### Migraciones seguras bajo carga

```sql
SET lock_timeout = '3s';
SET statement_timeout = '30s';
```

Una migración que espera indefinidamente por un lock no falla: **encola todas las consultas detrás de ella** y tumba la aplicación entera. Es preferible que la migración falle y se reintente.

`NOT NULL` sobre una tabla con datos se agrega en dos pasos: primero `CHECK ... NOT VALID`, luego `VALIDATE CONSTRAINT`, que no bloquea escrituras.

> [!warning]
> Un cambio en un estado de semáforo toca `catalogs.status_light_state`, `packages/domain`, la validación de transiciones y la UI. Va **en un solo PR** y requiere dos aprobaciones ([[Estándares de Desarrollo]] §2).

---

## 9. Crecimiento: qué escala y qué no

Punto de partida de D-01: **5,000 colaboradores y ~100 usuarios concurrentes**. A ese volumen, la mayoría del esquema no tiene un problema de escala y no debe diseñarse como si lo tuviera.

Las únicas cuatro tablas que crecen sin techo:

| Tabla                             | Crecimiento estimado                             | Qué hacer                                          |
| --------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| `journal.journal`                 | Todo evento del sistema, más la auditoría de PII | **Particionar por mes desde la primera migración** |
| `operations.punch_mark`           | 3 marcas × 5,000 × 5 días ≈ **3.9 M filas/año**  | Índice correcto. **Todavía no particionar**        |
| `operations.schedule_entry`       | Una fila por colaborador y día                   | Índice correcto                                    |
| `settlement.consolidation_detail` | Una fila por requisición y semana                | Índice correcto                                    |

> [!important]
> **3.9 millones de filas al año no justifican particionar.** Postgres maneja decenas de millones de filas sin despeinarse si el índice es el correcto. Particionar `punch_mark` hoy agrega complejidad de mantenimiento a cambio de nada.
>
> `journal` es el caso contrario, y no por volumen sino por forma: es append-only, se consulta siempre por rango de fecha y su retención es una política, no una decisión técnica. Particionarlo después significa reescribir la tabla entera con la aplicación detenida. Se hace desde el día uno porque **retrofitearlo es caro, no porque hoy duela**.

### Retención y archivado

| Dato                    | Retención         | Destino                                                                  |
| ----------------------- | ----------------- | ------------------------------------------------------------------------ |
| `journal`               | Vivo 24 meses     | Particiones antiguas a Cloud Storage; la tabla se desprende, no se borra |
| Fotos del ponche        | Definir con Legal | Cloud Storage, clase Nearline tras 90 días (D-08)                        |
| Consolidados y facturas | Permanente        | No se archiva: es información fiscal                                     |
| `blacklist_entry`       | Permanente        | RR-03                                                                    |

### Paginación

`?page=&limit=` sobre tablas grandes degrada: `OFFSET 100000` obliga a Postgres a recorrer 100,000 filas para descartarlas.

- **Listas de negocio** (requisiciones, colaboradores): offset está bien.
- **`journal` y `punch_mark`**: paginación por cursor (`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20`).

---

## 10. Concurrencia

| Tema                   | Regla                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Nivel de aislamiento   | `READ COMMITTED` (el de Postgres). No se sube salvo justificación                             |
| Bloqueo de slot        | `SELECT ... FOR UPDATE SKIP LOCKED` — D-02, RR-15                                             |
| Transacción del núcleo | `demand → coverage → operations` en **una sola transacción** (D-01)                           |
| Transacciones largas   | Prohibidas. Ninguna transacción abarca una llamada HTTP externa ni una subida a Cloud Storage |
| Reintentos             | Los errores de serialización se reintentan en la aplicación, con límite                       |

> [!warning]
> Una transacción abierta mientras se sube una foto a Cloud Storage mantiene locks durante segundos y bloquea el `autovacuum`. Primero se sube el archivo, después se abre la transacción que guarda la referencia.

---

## 11. Zona horaria y semana del hotel

**Todo instante se guarda en `timestamptz`, en UTC.** `timestamp` sin zona es la causa raíz de la mayoría de los errores de nómina por cambio de horario.

Pero el negocio no opera en UTC:

- La **semana** de nómina la define el [[Core/Módulos/Contrato|Contrato]] de cada hotel (`week_start`, `week_end`).
- La **jornada** de un ponche es un día natural en la zona del hotel, no en UTC. Un ponche de salida a las 23:30 hora local puede caer al día siguiente en UTC.

Por eso la jornada se guarda como `date` explícito (`punch_mark.work_date`) calculado en la zona del hotel, y **no se deriva de `capturado_at` al consultar**. Derivarla en cada consulta significa recalcular con una zona horaria que puede haber cambiado.

> [!note] Hueco cerrado
> `commercial.hotel.time_zone` **ya existe en la base** desde la migración `identity_y_hotel` (2026-08-08), como `text` obligatorio con nombre IANA. Lo que sigue pendiente es que [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]] lo refleje: el documento todavía no la lista.

---

## 12. Seguridad de los datos

| Tema                      | Regla                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Usuarios de base de datos | `app_user` (solo DML), `migrator` (DDL, solo en despliegue), `analytics_ro` (solo lectura, para el export a BigQuery) |
| Journal inmutable         | `REVOKE UPDATE, DELETE ON journal.journal FROM app_user` — RR-16                                                      |
| SSN e ITIN                | **Cifrado de campo**, no solo cifrado en reposo. Llave en Secret Manager (D-07)                                       |
| Acceso a PII              | Consultar el expediente de un colaborador **escribe en el journal**: quién, qué y cuándo                              |
| Datos fuera de producción | Ningún ambiente que no sea producción contiene PII real ([[Estándares de Desarrollo]] §8)                             |
| Respaldos                 | PITR activo en Cloud SQL. La restauración se **prueba**, al menos una vez por trimestre                               |

> [!note] Decisión tomada: sin Row Level Security
> Con un solo backend, RLS crearía una **segunda fuente de verdad de permisos** junto a la Matriz de Permisos, y dos que se contradicen tarde o temprano. El control de acceso vive en la aplicación; la base de datos protege **integridad**, no autorización. Si algún día hubiera acceso directo de terceros a la base, esta decisión se revisa.

> [!warning]
> Un respaldo que nunca se restauró no es un respaldo: es una suposición.

---

## 13. Acceso a la base desde tu máquina

La instancia vive en el proyecto **`oranjeapp-gcp`** y **no se conecta por su IP pública**, aunque la tenga: el camino es el **Cloud SQL Auth Proxy**, que autentica con tu identidad de IAM y expone la base en `localhost`. Nadie reparte la contraseña de `postgres` ni agrega su IP a las redes autorizadas cada vez que cambia de red.

| Qué                    | Valor                                                    |
| ---------------------- | -------------------------------------------------------- |
| Proyecto               | `oranjeapp-gcp`                                          |
| Instancia              | `oranje` (Postgres 15, `us-central1-b`)                  |
| Base                   | `oranje`                                                 |
| Usuario de desarrollo  | `oranje_dev`                                             |
| Puerto local del proxy | **5433** — no 5432, para no chocar con un Postgres local |

```bash
gcloud config set project oranjeapp-gcp
pnpm db:proxy      # = cloud-sql-proxy oranjeapp-gcp:us-central1:oranje --port 5433
```

Con el proxy levantado, **cualquier cliente se conecta a `localhost:5433`**, no a la IP de la instancia. El `DATABASE_URL` de `apps/api/.env` ya apunta ahí.

El repositorio tiene el resto en `docs/base-de-datos.md`: primeros pasos, los comandos `pnpm db:*`, cómo se consulta desde el código y los errores típicos con su causa. **La prueba de que la conexión funciona es `GET /api/v1/health/db`** — hace un ida y vuelta real a Postgres, no solo confirma que el pool existe.

> [!note] El pool no vive en la URL
> Prisma 7 ya no abre la conexión por su cuenta: exige un _driver adapter_. Por eso `max`, los timeouts y el `application_name` se configuran en `PrismaService` y no como parámetros del `DATABASE_URL`. Cloud SQL cuenta **conexiones, no procesos**: `DATABASE_POOL_MAX × instancias` no puede pasar del `max_connections` de la instancia.

### Con qué mirar las tablas

| Herramienta                                                        | Cuándo                                                                             | Costo                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------- |
| **Prisma Studio** (`pnpm --filter @oranje/api exec prisma studio`) | Ver y editar filas en el día a día. Lee el mismo `.env`, no se configura nada      | Gratis, ya está instalado     |
| **DBeaver Community**                                              | Diagramas ER entre esquemas y el visor espacial de PostGIS para la geocerca (D-08) | Gratis                        |
| **Cloud SQL Studio**                                               | Una consulta rápida sin nada instalado, desde la consola de Google                 | Gratis                        |
| `psql`                                                             | Scripts y migraciones a mano                                                       | Gratis (`brew install libpq`) |

> [!warning]
> **Nada vive en `public`.** Con un esquema por módulo (§1), `SELECT * FROM prospect` falla: hay que calificar (`commercial.prospect`) o fijar el `search_path` en la conexión guardada. Y en DBeaver hay que activar _Show all databases_, o solo se ve un esquema y parece que la base está vacía.

> [!note]
> `oranje_dev` es un usuario de **desarrollo**, no los tres de §12 (`app_user`, `migrator`, `analytics_ro`). Esa separación se aplica cuando exista el ambiente de producción; hoy la base solo tiene el esquema de Ventas y sus dos dependencias (D-15).

---

## 14. Checklist de PR que toca la base de datos

- [ ] Nombres conforme a §2, sin acentos ni eñes
- [ ] Tipos canónicos de §3 — dinero en `numeric`, instantes en `timestamptz`, duraciones en minutos
- [ ] Columnas obligatorias de §4 presentes
- [ ] Toda FK nueva tiene índice
- [ ] Índices únicos parciales si la tabla usa borrado lógico
- [ ] La regla de negocio quedó como restricción, no como validación de aplicación
- [ ] Migración reversible, o el PR explica por qué no
- [ ] Si es destructiva, va por expandir/contraer (§8)
- [ ] `EXPLAIN` adjunto si agrega consultas sobre tablas grandes
- [ ] Dos aprobaciones si toca semáforos, permisos o dinero

---

## 15. Decisiones pendientes

1. ~~**`time_zone` en `commercial.hotel`**~~ — **cerrado** el 2026-08-08: la columna existe en la base desde la migración `identity_y_hotel` (§11). Falta reflejarla en [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]].
2. **Esquema del expediente del Colaborador** — depende del hueco de módulo señalado en [[Estructura de Proyecto y Nomenclatura]] §3.
3. ~~**Idioma del esquema**~~ — **cerrado** por **D-11**: esquemas, tablas y columnas en inglés, sin excepciones (§2). El Colaborador es `worker` (`coverage.worker`, `vw_worker_pool`) desde el 2026-08-06.
4. **Retención de las fotos del ponche** — la define Legal, no Ingeniería (§9).
5. **Los tres usuarios de §12** — hoy todos usan `oranje_dev`, que puede hacer DDL. `app_user` / `migrator` / `analytics_ro` se separan cuando exista producción, y hasta entonces cualquiera con la contraseña puede borrar una tabla.

---

## Relacionado

- [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]] — entidades, relaciones e invariantes
- [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]] — D-01 (esquemas por módulo), D-02 (concurrencia), D-07 (secretos), D-08 (geocerca)
- [[Estructura de Proyecto y Nomenclatura]] — nomenclatura de código y glosario canónico
- [[Estándares de Desarrollo]] — Git, PRs, API, testing y despliegue
- [[Core/Módulos/Reglas de Negocio|Reglas de Negocio]] — fuente de verdad
