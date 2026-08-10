# Conectarse a la base

Todo lo que necesitas para trabajar contra la base de Oranje. La regla de fondo
vive en el vault, en `Estándares de Base de Datos`; aquí está la operación.

---

## 1. Qué hay del otro lado

| Qué                    | Valor                                                   |
| ---------------------- | ------------------------------------------------------- |
| Proyecto de GCP        | `oranjeapp-gcp`                                         |
| Instancia de Cloud SQL | `oranje` — Postgres 15, `us-central1-b`                 |
| Base                   | `oranje`                                                |
| Usuario                | `oranje_dev`                                            |
| Puerto local           | **5433** (no 5432, para no chocar con un Postgres tuyo) |

La instancia tiene IP pública, pero **no se conecta por ahí**. El camino es el
**Cloud SQL Auth Proxy**: autentica con tu identidad de Google y expone la base
en `localhost`. Nadie reparte la contraseña de `postgres` ni anda agregando su
IP a las redes autorizadas cada vez que cambia de wifi.

---

## 2. Primera vez

```bash
# 1. Herramientas de Google
brew install --cask google-cloud-sdk
brew install cloud-sql-proxy

# 2. Tu identidad. Pide que te agreguen a oranjeapp-gcp con el rol
#    "Cloud SQL Client" antes de esto
gcloud auth login
gcloud auth application-default login
gcloud config set project oranjeapp-gcp

# 3. El repo
pnpm install
cp .env.example apps/api/.env      # y pon la contraseña de oranje_dev
```

> La contraseña de `oranje_dev` **no está en el repositorio** y no se manda por
> chat. Pídela por el canal que use el equipo para secretos.

---

## 3. El día a día

Dos terminales. En la primera, el proxy — **déjalo corriendo**:

```bash
pnpm db:proxy
```

En la segunda, lo que vayas a hacer:

```bash
pnpm db:status                     # ¿la base está al día con las migraciones?
pnpm -F @oranje/api dev            # levanta el API en :3000
curl localhost:3000/api/v1/health/db
```

Si `health/db` responde `{"status":"ok"}`, tu conexión está bien y puedes
olvidarte de este documento.

| Comando            | Qué hace                                                        |
| ------------------ | --------------------------------------------------------------- |
| `pnpm db:proxy`    | Levanta el Cloud SQL Auth Proxy en `localhost:5433`             |
| `pnpm db:status`   | Dice si faltan migraciones por aplicar                          |
| `pnpm db:migrate`  | Crea y aplica una migración nueva a partir de `schema.prisma`   |
| `pnpm db:deploy`   | Aplica las migraciones pendientes sin crear ninguna (CI y prod) |
| `pnpm db:studio`   | Prisma Studio: ver y editar filas en el navegador               |
| `pnpm db:generate` | Regenera el cliente de Prisma tras tocar el schema              |

---

## 4. Cómo se consulta desde el código

Inyectas `PrismaService`. Nadie instancia su propio `PrismaClient`:

```ts
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infra/prisma/index.js'

@Injectable()
export class ProspectService {
  constructor(private readonly prisma: PrismaService) {}

  async findByHotel(hotelId: string) {
    return this.prisma.prospect.findMany({
      where: { hotelId },
      include: { onboardingState: true },
    })
  }
}
```

El `PrismaModule` es `@Global`, así que no tienes que importarlo en tu módulo.

### Tres cosas que muerden

1. **Nada vive en `public`.** Hay un esquema por módulo, así que en SQL crudo
   `SELECT * FROM prospect` truena: es `commercial.prospect`. Con el cliente de
   Prisma no te enteras — el esquema ya viene en el modelo.
2. **El `id` lo genera la aplicación**, no la base. Es un **UUID v7** y no hay
   `DEFAULT` en la llave primaria: si insertas sin `id`, falla. Usa `uuidv7()`
   del paquete `uuid`, que ya está instalado.
3. **`updated_at` lo mantiene un trigger de Postgres.** No lo pongas tú en el
   `update`: el valor que mandes se pisa.

---

## 5. Qué hay en la base hoy

Diecisiete tablas y dos vistas, en tres esquemas, y un módulo de NestJS por
esquema:

| Esquema / módulo | Submódulo            | Tablas                                                                                       |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| `catalogs`       | `status-lights/`     | `status_light` · `status_light_state` · `status_light_transition` · `status_change_reason`   |
|                  | `zones/`             | `zone`                                                                                       |
|                  | `hotel-departments/` | `hotel_department`                                                                           |
| `identity`       | `users/`             | `user`                                                                                       |
|                  | `roles/`             | `role` · `role_permission`                                                                   |
| `commercial`     | `hotels/`            | `hotel` · `hotel_contact` · vista `vw_client`                                                |
|                  | `onboarding/`        | `prospect` · `prospect_state_history` · `contact_attempt` · `proposal` · vista `vw_prospect` |
|                  | `territories/`       | `user_zone`                                                                                  |

Los tres módulos están registrados en `AppModule` y vacíos: la carpeta de cada
submódulo espera su `controller`, `service` y `repository`. La anatomía la manda
`Estructura de Proyecto y Nomenclatura` §3 — el `service` no toca Prisma directo,
eso es del `repository`.

Los otros siete esquemas —`demand`, `coverage`, `operations`, `settlement`,
`supervision`, `journal`, `notifications`— **existen y están vacíos** a
propósito, y no tienen módulo todavía. Sus tablas entran cuando el diagrama de
su departamento esté aprobado, no antes.

> **No agregues tablas fuera del diagrama aprobado.** El modelo vigente de
> `commercial` es `Ventas - Modelo de Datos v2.drawio` en el vault, y el esquema
> real tiene que poder compararse contra él sin sorpresas.

`vw_client` son los ciclos abiertos en `ORANGE` o `BLACK`; `vw_prospect`, los
otros siete códigos. _"¿Es cliente?"_ es un join, no una columna: no hay nada que
se pueda desincronizar.

### Cinco cosas que están en la base y no en el diagrama

Auditado el 2026-08-10. Ninguna se borró: quitar una columna es destructivo y la
decisión no es de quien audita.

| Qué                         | De dónde salió                                        | Propuesta                                                                                                                      |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `identity.role_permission`  | `Modelo de Datos` §9                                  | Se queda. Ya está justificada                                                                                                  |
| `catalogs.hotel_department` | `Modelo de Datos` §9 — `user.department_id` le apunta | Se queda. Ya está justificada                                                                                                  |
| `contact_attempt.notes`     | Se agregó al implementar                              | Se queda: el resultado es una lista cerrada de 4 valores y el detalle del intento no cabe en ninguno                           |
| `identity.user.is_active`   | Se agregó al implementar                              | Se queda: dar de baja a alguien sin borrar su historia necesita esta columna, y §4 reserva el borrado lógico para otras tablas |
| `catalogs.zone.code`        | Se agregó al implementar                              | Se queda: los otros cuatro catálogos tienen `code`, y el seed necesita una llave estable que no sea el nombre                  |

**Lo que hay que corregir es el diagrama, no la base.** Las tres columnas se
agregan a `Ventas - Modelo de Datos v2.drawio`; las dos tablas viven en
`Modelo de Datos` y solo falta que el diagrama de Ventas las dibuje como _"tabla
de otro módulo"_, que es lo que su propia leyenda ya contempla.

### Falta el seed

`prisma/seed.ts` lanza un error a propósito: los catálogos todavía no están
sembrados. Sin las filas de `status_light_state` y `status_light_transition`, el
semáforo no camina y cualquier transición devuelve 409. Es la Fase 3 del Plan de
Implementación y va antes que los CRUD que dependan de estados.

---

## 6. Con qué mirar las tablas

| Herramienta           | Cuándo                                                            |
| --------------------- | ----------------------------------------------------------------- |
| **Prisma Studio**     | El día a día. `pnpm db:studio`, lee tu mismo `.env`               |
| **DBeaver Community** | Diagramas ER entre esquemas y el visor de PostGIS                 |
| **Cloud SQL Studio**  | Una consulta rápida sin instalar nada, desde la consola de Google |
| `psql`                | Scripts a mano (`brew install libpq`)                             |

> En DBeaver hay que activar **Show all databases**, o solo ves un esquema y
> parece que la base está vacía.

---

## 7. Cuando algo falla

| Síntoma                                                | Qué pasa                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `ECONNREFUSED 127.0.0.1:5433`                          | El proxy no está corriendo. `pnpm db:proxy`                  |
| `password authentication failed for user "oranje_dev"` | La contraseña del `.env` está mal                            |
| `Configuración de entorno inválida: …`                 | Te falta una variable. El mensaje dice cuál                  |
| `relation "prospect" does not exist`                   | SQL crudo sin calificar el esquema. Es `commercial.prospect` |
| `schema "X" does not exist` al migrar                  | Tu base está atrás. `pnpm db:deploy`                         |
| El proxy dice `403` o `PERMISSION_DENIED`              | Te falta el rol **Cloud SQL Client** en `oranjeapp-gcp`      |

---

## 8. Sobre las conexiones

El pool se configura en `PrismaService`, no en la URL. Cloud SQL cuenta
conexiones, no procesos: cada instancia del API abre hasta `DATABASE_POOL_MAX`,
y `max × instancias` no puede pasar del `max_connections` de la instancia.

| Variable                        | Default | Para qué                                     |
| ------------------------------- | ------- | -------------------------------------------- |
| `DATABASE_POOL_MAX`             | 10      | Conexiones por instancia del API             |
| `DATABASE_CONNECT_TIMEOUT_MS`   | 10000   | Espera por un lugar del pool antes de fallar |
| `DATABASE_STATEMENT_TIMEOUT_MS` | 15000   | Techo de una consulta suelta                 |

En producción la URL cambia de host, no de forma: Cloud Run se conecta por el
socket unix `/cloudsql/oranjeapp-gcp:us-central1:oranje` y no necesita proxy.

---

## 9. Un usuario, por ahora

Hoy todos usamos `oranje_dev`. Los tres usuarios que pide el estándar —`app_user`
solo DML, `migrator` solo en despliegue, `analytics_ro` solo lectura— se separan
cuando exista el ambiente de producción. Mientras tanto, quien tenga la
contraseña puede borrar tablas: cuidado con `pnpm db:migrate` si no sabes qué va
a generar. Revisa siempre el SQL antes de aplicarlo.
