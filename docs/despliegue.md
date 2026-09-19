# Ambientes y despliegue

Dos ambientes desplegados. `local` es tu máquina y no cuenta: no tiene proyecto
de GCP ni pipeline.

| `APP_ENV`    | Proyecto de GCP | Rama      | Se despliega | Estado                             |
| ------------ | --------------- | --------- | ------------ | ---------------------------------- |
| `staging`    | `oranjeapp-gcp` | `staging` | Al mergear   | **Desplegado** desde el 2026-08-13 |
| `production` | `oranje-prod`   | `main`    | Al mergear   | Sin desplegar todavía              |

Staging responde en `https://oranje-api-endngsd2ra-uc.a.run.app`, **sin acceso
público**: pide token de Cloud Run. Para probarlo:

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://oranje-api-endngsd2ra-uc.a.run.app/api/v1/health/db
```

`oranjeapp-gcp` es el proyecto que ya existe, con la base y el seed cargados —
por eso se queda como staging en vez de crear uno nuevo y migrarlo.

> **El ID de un proyecto de GCP no se puede cambiar.** Se renombró lo único
> renombrable, que es el nombre visible (`Oranje Staging`); el ID sigue siendo
> `oranjeapp-gcp` y así aparece en toda la configuración. Tenerlo como
> `oranje-staging` exigiría un proyecto nuevo y mover instancia, base, secretos,
> registro y federación — y la base de staging es la que tiene los datos con los
> que se está trabajando.

> **Un solo artefacto.** La imagen se construye una vez, en `staging`. Producción
> **no reconstruye**: promueve el mismo digest que ya se probó. Si el commit no
> pasó por staging, el despliegue a producción se detiene con error.

---

## 1. Qué se creó, el 2026-08-13

> Esto **ya está hecho**. Queda escrito para poder reproducirlo o auditarlo, no
> para volver a ejecutarlo.

| Recurso               | `oranjeapp-gcp` (staging)               | `oranje-prod`                                                        |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Proyecto              | Ya existía                              | Creado, org `todoorange.com`                                         |
| Cloud SQL             | `oranje` · `db-f1-micro`                | `oranje` · `db-g1-small`, PITR, respaldos 14 días, borrado protegido |
| Usuarios de la base   | `oranje_dev` · `app_user`               | `oranje_dev` · `app_user`                                            |
| Artifact Registry     | `oranje` (us-central1)                  | `oranje` (us-central1)                                               |
| Bucket                | `oranje-staging-files`                  | `oranje-prod-files`                                                  |
| Secretos              | 4                                       | 4                                                                    |
| Cuenta que despliega  | `deploy-github@…`                       | `deploy-github@…`                                                    |
| Cuenta que ejecuta    | `oranje-api@…`                          | `oranje-api@…`                                                       |
| Federación con GitHub | Pool `github`, atada a `dev3-cc/oranje` | Igual                                                                |

**La instancia de producción no es igual a la de staging**: `db-g1-small` en vez
de `db-f1-micro`, con recuperación punto en el tiempo y protección de borrado.
PITR va desde el día uno porque activarlo después no recupera lo ya perdido.

**Los pares de llaves son distintos entre ambientes.** Con llave compartida, un
token de staging valdría en producción.

### Si hubiera que reproducirlo

Requiere `gcloud auth login` con una cuenta que pueda crear proyectos y
administrar el de destino.

### 1.1 El proyecto de producción

```bash
gcloud projects create oranje-prod --name="Oranje Producción"
gcloud billing projects link oranje-prod --billing-account=CUENTA_DE_FACTURACION

for API in run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
           secretmanager.googleapis.com cloudbuild.googleapis.com iamcredentials.googleapis.com; do
  gcloud services enable "$API" --project=oranje-prod
done
```

Las mismas APIs en `oranjeapp-gcp`, donde puede que ya estén activas.

### 1.2 Registro de imágenes

En **los dos** proyectos:

```bash
gcloud artifacts repositories create oranje \
  --repository-format=docker --location=us-central1 --project=PROYECTO
```

### 1.3 Base de datos de producción

```bash
gcloud sql instances create oranje \
  --database-version=POSTGRES_15 --region=us-central1 \
  --tier=db-g1-small --storage-auto-increase \
  --backup --enable-point-in-time-recovery \
  --project=oranje-prod

gcloud sql databases create oranje --instance=oranje --project=oranje-prod
```

PITR va desde el día uno: Estándares de BD §12 lo pide, y activarlo después no
recupera lo que ya se perdió.

Después, los usuarios del split (`oranje_dev` como dueño, `app_user` para la
aplicación) y correr las migraciones. **No se copia nada de staging**: producción
nace vacía y se llena con el seed de catálogos, nunca con datos de prueba.

### 1.4 Secretos

Cada ambiente lleva **su propio par de llaves**. Con llave compartida, un token
de staging valdría en producción.

```bash
pnpm -F @oranje/api auth:keys > /tmp/llaves.env    # y bórralo al terminar

gcloud secrets create oranje-jwt-private-key --project=PROYECTO --data-file=-
gcloud secrets create oranje-jwt-public-key  --project=PROYECTO --data-file=-
gcloud secrets create oranje-database-url    --project=PROYECTO --data-file=-
gcloud secrets create oranje-migrate-database-url --project=PROYECTO --data-file=-
```

En producción la cadena usa el socket unix, no el proxy:

```
postgresql://app_user:CONTRASENA@localhost/oranje?host=/cloudsql/oranje-prod:us-central1:oranje
```

### 1.5 Identidad del despliegue

Sin llaves de cuenta de servicio: GitHub firma un token y GCP lo cambia por
credenciales (Workload Identity Federation). Una llave guardada como secreto de
repositorio no caduca y no se puede revocar sin darse cuenta.

```bash
gcloud iam service-accounts create deploy-github --project=PROYECTO

gcloud iam workload-identity-pools create github --location=global --project=PROYECTO
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition="assertion.repository=='dev3-cc/oranje'" \
  --project=PROYECTO
```

`attribute-condition` no es opcional: sin ella, **cualquier repositorio de
GitHub** podría pedir credenciales de este proyecto.

La cuenta necesita `run.admin`, `artifactregistry.writer`,
`cloudsql.client`, `secretmanager.secretAccessor` y `iam.serviceAccountUser`.
Producción además necesita leer del registro de staging para promover el digest.

---

## 2. Variables de GitHub, por ambiente

Los ambientes `staging` y `production` ya existen en **Settings → Environments**,
con estas variables cargadas. Son variables, no secretos: ninguna es sensible —
los secretos de verdad viven en Secret Manager y el pipeline solo los nombra.

| Variable                  | `staging`                          | `production`                     |
| ------------------------- | ---------------------------------- | -------------------------------- |
| `GCP_PROJECT_ID`          | `oranjeapp-gcp`                    | `oranje-prod`                    |
| `STAGING_PROJECT_ID`      | —                                  | `oranjeapp-gcp`                  |
| `APP_ENV`                 | `staging`                          | `production`                     |
| `WIF_PROVIDER`            | pool `github` del proyecto         | pool `github` del proyecto       |
| `DEPLOY_SERVICE_ACCOUNT`  | `deploy-github@oranjeapp-gcp…`     | `deploy-github@oranje-prod…`     |
| `RUNTIME_SERVICE_ACCOUNT` | `oranje-api@oranjeapp-gcp…`        | `oranje-api@oranje-prod…`        |
| `CLOUDSQL_INSTANCE`       | `oranjeapp-gcp:us-central1:oranje` | `oranje-prod:us-central1:oranje` |
| `STORAGE_BUCKET`          | `oranje-staging-files`             | `oranje-prod-files`              |
| `MIN_INSTANCES`           | `0` — que se apague y no cobre     | `1` — sin arranque en frío       |
| `MAX_INSTANCES`           | `2`                                | `4`                              |

**Faltan tres**, y no bloquean a staging pero sí a producción:

| Variable          | Por qué falta                     | `staging`        | `production` |
| ----------------- | --------------------------------- | ---------------- | ------------ |
| `AUTH_ISSUER_URL` | No existe el proyecto de Firebase | Levanta sin ella | No arranca   |
| `AUTH_AUDIENCE`   | Igual                             | Levanta sin ella | No arranca   |
| `CORS_ORIGINS`    | No hay dominio del front todavía  | Levanta sin ella | No arranca   |

**Staging levanta incompleto a propósito**: sirve para probar los CRUD antes de
que exista Firebase. Lo único que no funciona es `POST /auth/session`, que
responde `503 LOGIN_NOT_CONFIGURED`. Un token de Oranje ya emitido se sigue
verificando, así que el guard y los endpoints se pueden probar hoy.

Producción no afloja: ahí la lista blanca y el proveedor de identidad son lo que
separa _desplegado_ de _abierto_.

Dos cuentas de servicio por ambiente, a propósito: **`deploy-github` despliega y
`oranje-api` ejecuta**. La que corre el servicio no puede desplegar, y la que
despliega no anda leyendo la base en producción. Eso aplica a la **automatización**
— las personas con `roles/owner` en el proyecto pueden hacer las dos cosas.

> **Aprobación manual activada** en el ambiente `production` de GitHub: un
> despliegue a producción espera aprobación de `dev3-cc`, y solo desde ramas
> protegidas.

`MAX_INSTANCES × DATABASE_POOL_MAX` no puede pasar del `max_connections` de la
instancia. Con `DATABASE_POOL_MAX=10` y 100 conexiones, el techo son 10
instancias — y hay que dejar margen para las migraciones y para quien se conecte
a mirar.

---

## 3. Qué pasa cuando algo falla

**Falta una variable** — el contenedor no arranca: la validación de entorno lo
tumba enumerando qué falta. Cloud Run mantiene la revisión anterior sirviendo, y
el paso de verificación del pipeline falla. **El servicio no se cae.**

**La migración falla** — el job se detiene antes de desplegar la revisión nueva,
así que el código viejo sigue corriendo contra el esquema viejo.

**Hay que volver atrás** — cada despliegue a producción deja un tag. Se
redespliega ese digest; no se reconstruye.

```bash
gcloud run services update-traffic oranje-api \
  --to-revisions=REVISION_ANTERIOR=100 --region=us-central1 --project=oranje-prod
```

> Volver atrás en el **código** es un comando. Volver atrás en una **migración
> destructiva** no lo es: por eso §8 pide expandir y contraer, y por eso el
> `DROP` de una columna va en un despliegue posterior al que dejó de usarla.

---

## 4. Lo que costó la primera corrida

El pipeline falló **tres veces** antes de desplegar, y las tres son cosas que no
se pueden ver sin construir de verdad:

1. **`gcloud builds submit --tag` exige el Dockerfile en la raíz** del contexto,
   y el nuestro vive en `apps/api`. Pero el contexto tiene que ser la raíz del
   monorepo, donde están el lockfile y los otros `package.json`. Las dos cosas no
   se pueden con `--tag`: de ahí el `cloudbuild.yaml`.
2. **Node 25 sacó `corepack`** de la imagen oficial, y el `.nvmrc` fija 26. El
   `corepack enable` moría con _command not found_. pnpm se instala con `npm`.
3. **El job de migraciones corría desde `/app`** y Prisma no encontraba su
   configuración, que vive en `apps/api` y declara rutas relativas a esa carpeta.

Verificado contra el servicio desplegado: `/health/db` contesta, la base
responde por el socket unix, `/auth/session` da 503 porque no hay Firebase, y
toda ruta protegida rechaza sin token.

---

## 5. Lo que falta

- **No existe el proyecto de Firebase**, así que `AUTH_ISSUER_URL` y
  `AUTH_AUDIENCE` están vacías. Staging levanta igual, pero **el login no
  funciona**: `/auth/session` responde 503.
- **`CORS_ORIGINS` tampoco**, porque no hay dominio del front. Producción no
  arranca sin ella.
- **Producción nunca se ha desplegado** y su base está vacía: sin migraciones ni
  seed, a propósito.
- **Sin dominio ni Load Balancer**: Cloud Run responde en su URL `run.app`.
- **Sin alertas de nómina** — D-07 las pide, y no existen.
