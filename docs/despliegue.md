# Ambientes y despliegue

Dos ambientes desplegados. `local` es tu máquina y no cuenta: no tiene proyecto
de GCP ni pipeline.

| `APP_ENV`    | Proyecto de GCP | Rama      | Se despliega |
| ------------ | --------------- | --------- | ------------ |
| `staging`    | `oranjeapp-gcp` | `staging` | Al mergear   |
| `production` | `oranje-prod`   | `main`    | Al mergear   |

`oranjeapp-gcp` es el proyecto que ya existe, con la base y el seed cargados —
por eso se queda como staging en vez de crear uno nuevo y migrarlo.

> **Un solo artefacto.** La imagen se construye una vez, en `staging`. Producción
> **no reconstruye**: promueve el mismo digest que ya se probó. Si el commit no
> pasó por staging, el despliegue a producción se detiene con error.

---

## 1. Qué se crea, una sola vez

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

En **Settings → Environments**, uno llamado `staging` y otro `production`. Son
variables, no secretos: ninguna es sensible — los secretos de verdad viven en
Secret Manager y el pipeline solo los nombra.

| Variable                 | `staging`                                   | `production`                              |
| ------------------------ | ------------------------------------------- | ----------------------------------------- |
| `GCP_PROJECT_ID`         | `oranjeapp-gcp`                             | `oranje-prod`                             |
| `STAGING_PROJECT_ID`     | —                                           | `oranjeapp-gcp`                           |
| `APP_ENV`                | `staging`                                   | `production`                              |
| `WIF_PROVIDER`           | el del proyecto                             | el del proyecto                           |
| `DEPLOY_SERVICE_ACCOUNT` | `deploy-github@…`                           | `deploy-github@…`                         |
| `CLOUDSQL_INSTANCE`      | `oranjeapp-gcp:us-central1:oranje`          | `oranje-prod:us-central1:oranje`          |
| `AUTH_ISSUER_URL`        | `https://securetoken.google.com/<firebase>` | idem, con el proyecto de Firebase de prod |
| `AUTH_AUDIENCE`          | el project-id de Firebase                   | idem                                      |
| `CORS_ORIGINS`           | el dominio de staging                       | el dominio de producción                  |
| `STORAGE_BUCKET`         | el bucket de staging                        | el de producción                          |
| `MIN_INSTANCES`          | `0` — que se apague y no cobre              | `1` — sin arranque en frío                |
| `MAX_INSTANCES`          | `2`                                         | según carga                               |

> En el ambiente `production` de GitHub, activa **required reviewers**. Es lo
> que convierte el merge a `main` en una decisión y no en un accidente.

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

## 4. Lo que falta

- **El Dockerfile no se ha construido nunca.** No hay Docker en la máquina donde
  se escribió; el primer `gcloud builds submit` es su primera prueba real.
- **No existe el proyecto de Firebase**, así que `AUTH_ISSUER_URL` y
  `AUTH_AUDIENCE` no tienen valor todavía y el login no funciona en la nube.
- **`oranje-prod` no está creado.** Todo lo de la sección 1 está pendiente.
- **Sin dominio ni Load Balancer**: hoy Cloud Run responde en su URL `run.app`.
