---
tags:
  - arquitectura
  - global
  - ingenieria
aliases:
  - Estructura de Proyecto
  - Nomenclatura
  - Convenciones de Código
  - Estándares de Estructura
---

# Estructura de Proyecto y Nomenclatura

Define cómo se organiza el código de la plataforma Oranje: topología de repositorio, estructura de carpetas de backend y frontend, y reglas de nombrado. Es el documento que debe leer cualquier persona antes de crear su primer archivo en el proyecto.

> [!info]
> **Alcance:** organización física del código. Las decisiones de infraestructura y despliegue que este documento materializa viven en [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]] (D-01 … D-10). Las reglas de proceso (Git, PRs, API, base de datos, testing, DoD) viven en [[Estándares de Desarrollo]]. Las reglas de negocio que el código implementa viven en [[Reglas de Negocio]].

> [!important]
> Este documento **no decide arquitectura**: la traduce a carpetas. Ante conflicto con [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]] o con [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]], ganan ellos. La trazabilidad decisión → estructura está en la §10.

---

## 1. Stack

| Capa               | Tecnología                        | Notas                                                                                                         |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Backend            | **NestJS** + TypeScript           | Monolito modular: los 10 módulos de D-01, un solo desplegable                                                 |
| ORM                | **Prisma**                        | Archivo único `apps/api/prisma/schema.prisma`, con **un esquema Postgres por módulo** (D-01)                  |
| Base de datos      | **PostgreSQL** (Cloud SQL)        | Una sola instancia; locks de fila para el Self-Pick (D-02)                                                    |
| Frontend web       | **React** + TypeScript + Vite     | SPA con render por sección (ver [[Estructura General App]])                                                   |
| App móvil          | **React Native** + TypeScript     | Colaborador e Inspector: ponche con GPS y foto, trabajo offline (D-05, D-08)                                  |
| Identidad          | **Firebase Auth** (JWT)           | Autoridad de identidad. Los **permisos viven en Postgres**, no en el token (D-05)                             |
| Push y offline     | **FCM** + **Firestore**           | Exclusivos de la app móvil; el backend no lee Firestore                                                       |
| Estado del cliente | **Redux Toolkit** + **RTK Query** | Un solo store: estado de UI en slices, **caché del servidor en RTK Query**                                    |
| Estilos web        | **Tailwind CSS 4**                | Tema en CSS con `@theme`, emitido desde `tokens.ts`; vía `@tailwindcss/vite` (D-12, enmienda)                 |
| Estilos del móvil  | **NativeWind** (Tailwind 3)       | Traduce las clases Tailwind a `StyleSheet` de React Native. Se queda en v3 hasta que NativeWind 5 sea estable |
| Componentes web    | **shadcn/ui** (sobre Radix)       | **Se copia el código**, no es dependencia de runtime: vive en `packages/ui/src/components/ui/` (D-16)         |
| Componentes móvil  | **react-native-reusables**        | El mismo enfoque sobre NativeWind y rn-primitives; vive en `apps/mobile/src/shared/ui/` (D-16)                |
| Tablas de datos    | **TanStack Table**                | shadcn aporta el markup; el ordenamiento, la paginación y el filtrado los pone esta librería                  |
| Ruteo web          | **React Router 8** (_data mode_)  | Paquete `react-router`, no `react-router-dom`. Sin framework mode: la web es artefacto estático (D-04, D-17)  |
| Gráficas           | **Recharts**                      | Embudo nativo para el dashboard de Ventas; anima por defecto (D-17)                                           |
| Mapas              | **`@vis.gl/react-google-maps`**   | Librería oficial de Google. La API key es pública y se restringe por referrer (D-17)                          |
| Tipografía         | **Montserrat**                    | Fuente variable servida desde el bundle, no Google Fonts (ver [[Convenciones de Diseño]])                     |
| Gestor de paquetes | **pnpm** (workspaces)             | Obligatorio; no mezclar con npm ni yarn                                                                       |

> [!note]
> La web se despliega como **artefacto estático** detrás de Cloud Load Balancing + Cloud Armor; el backend es el **único servicio de Cloud Run** (D-01, D-04). Ningún cliente habla directo con Cloud SQL.

> [!note]
> **El stack del frontend ya tiene ADR.** Redux Toolkit, RTK Query, Tailwind y NativeWind están en **D-12**; las librerías de componentes, en **D-16**; el router, las gráficas y el mapa, en **D-17**. Este documento registra el stack vigente y su forma en el repositorio; el _por qué_ y _qué lo haría cambiar_ se consultan en [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]].

---

## 2. Topología del repositorio

**Un solo repositorio (monorepo) con pnpm workspaces**, con **tres aplicaciones**: `api`, `web` y `mobile`.

### Por qué backend y frontends comparten repositorio

Primero, porque ya está decidido: D-01 dice literalmente _"un repositorio, un servicio de Cloud Run, una base de datos"_. Lo que esa decisión declara único es el **desplegable del backend**, no el repositorio, y no impide que el repo contenga los clientes.

Y además, porque el vault documenta cuatro contratos que los tres clientes comparten con el backend:

1. **Los semáforos son contrato compartido.** Los 12 estados del [[Semáforo del Colaborador]], los 6 del [[Semáforo de Requisición]] y los 5 semáforos restantes deben tener valores idénticos en backend y frontend. En repos separados ese enum se duplica y diverge en el primer cambio de estado.
2. **Los catálogos también.** [[Posiciones]], [[Zonas]], [[Niveles de Inglés]], [[Departamentos del Hotel]] y [[Modalidades de Contratación]] los consumen ambos lados.
3. **La Matriz de Permisos es una sola.** El guard del backend y el render condicional del frontend deben leer la misma tabla de permisos por rol, no dos copias.
4. **Un cambio de negocio toca los tres lados.** Agregar un estado al Semáforo de Requisición es un solo PR atómico, revisable de una pieza, en lugar de tres PRs en tres repos que hay que mergear en orden.

> [!important]
> **Un repositorio ≠ un artefacto.** Del monorepo salen **tres artefactos con pipelines independientes**:
>
> - `apps/api` → imagen de contenedor, el **único servicio de Cloud Run** (D-01)
> - `apps/web` → bundle estático detrás del Load Balancer (D-04)
> - `apps/mobile` → builds de tienda + OTA
>
> Compartir repositorio no acopla despliegues: acopla **contratos**, que es justo lo que se busca. Tampoco exige Turborepo desde el inicio: se arranca con pnpm workspaces a secas y se agrega cuando los tiempos de build lo justifiquen.

La variante de repositorios separados está **descartada** por D-01; el costo que evita se documenta en el [anexo](#anexo-por-qué-no-repositorios-separados).

### Raíz del monorepo

```
oranje/
├── apps/
│   ├── api/                  # NestJS — monolito modular (D-01)
│   ├── web/                  # React — Reclutamiento · Hotel · Ventas · QA · CS · Contabilidad
│   └── mobile/               # React Native — Worker · Inspector (D-05)
├── packages/
│   ├── contracts/            # DTOs y tipos compartidos api ↔ web ↔ mobile
│   ├── domain/               # semáforos, catálogos, matriz de permisos
│   ├── ui/                   # preset de Tailwind con los tokens Oranje + componentes web
│   └── config/               # configs compartidas de eslint/tsconfig/prettier
├── infra/                    # IaC de los 3 proyectos de GCP (D-06)
├── docs/                     # ADRs y documentación técnica
├── .github/workflows/        # CI
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**Regla de dependencias (unidireccional, sin ciclos):**

```
apps/api    ──┐
apps/web    ──┼──> packages/contracts ──> packages/domain
apps/mobile ──┘
apps/web    ──┐
apps/mobile ──┴──> packages/ui        # el preset de Tailwind lo usan los dos;
                                      # los componentes, solo el web
```

`packages/domain` no importa de nadie. `packages/*` nunca importa de `apps/*`. `apps/*` nunca importa de otro `apps/*`: lo que compartan, sube a `packages/`.

---

## 3. Estructura del backend (`apps/api`)

Monolito modular: **los 10 módulos de D-01**, ni uno más. No se crea un módulo Nest por entidad ni por departamento del vault; los `04 - Por Módulo` de cada departamento se **mapean** a estos 10 (tabla más abajo).

```
apps/api/
├── prisma/
│   ├── schema.prisma                 # multiSchema: un esquema por módulo
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── common/                       # transversal, sin lógica de negocio
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   │
│   ├── config/                       # carga y validación de env
│   │   ├── config.module.ts
│   │   └── env.validation.ts
│   │
│   ├── infra/                        # adaptadores a servicios externos
│   │   ├── prisma/
│   │   ├── firebase/                 # verifica el ID token de Firebase Auth (D-05)
│   │   ├── storage/                  # Cloud Storage — URLs firmadas
│   │   ├── pubsub/                   # publica eventos fuera del núcleo (D-03)
│   │   ├── secrets/                  # Secret Manager · cifrado de campo SSN/ITIN (D-07)
│   │   └── mailer/
│   │
│   └── modules/                      # los 10 módulos de D-01
│       ├── identity/
│       ├── commercial/
│       ├── demand/
│       ├── coverage/
│       ├── operations/
│       ├── settlement/
│       ├── supervision/
│       ├── journal/
│       ├── notifications/
│       └── catalogs/
└── test/                             # pruebas e2e
```

> [!note]
> D-01 escribe esta carpeta como `modulos/`. Aquí es `modules/`, igual que `common/`, `config/` e `infra/`. Pero los **nombres de los módulos** que van dentro sí son los de D-01, en español y sin traducir: `demand/`, `coverage/`, `settlement/`. Es la misma frontera que en Postgres — el contenedor en inglés, el módulo de negocio en español (§8 y [[Estándares de Base de Datos]] §2).

### Mapa de módulos

| Módulo          | Qué del vault cubre                                                                                                                                                  | Esquema Postgres |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `identity`      | Usuario · Rol · Matriz de Permisos · verificación del token de Firebase                                                                                              | `identity`       |
| `commercial`    | [[Ventas/Onboarding-Hotel/Flujo de Onboarding\|Onboarding]] · Hotel · [[Core/Módulos/Contrato\|Contrato]] · tarifas por posición                                     | `commercial`     |
| `demand`        | [[Core/Módulos/Requisicion/Requisición\|Requisición]] · Posición · Slot · Urgencia                                                                                   | `demand`         |
| `coverage`      | Self-Pick (Participación) · Asignación · [[Core/Módulos/Blacklist\|Blacklist]] · [[Pool de Colaboradores]] · expediente del [[Colaborador/Colaborador\|Colaborador]] | `coverage`       |
| `operations`    | [[Core/Módulos/Schedule\|Schedule]] · [[Timesheet]] · Ponche (GPS, foto, geocerca) · estado y aprobación del ponche (D-09)                                           | `operations`     |
| `settlement`    | Consolidado (detalle **por requisición**, D-10) · [[Deducciones]] · Factura · Vacaciones                                                                             | `settlement`     |
| `supervision`   | Inspección · [[Core/Módulos/Accidente Laboral/Accidente Laboral\|Accidente Laboral]] · QA · Customer Service                                                         | `supervision`    |
| `journal`       | Bitácora append-only (RR-16) + auditoría de acceso a PII                                                                                                             | `journal`        |
| `notifications` | Consumidor de eventos de Pub/Sub · push FCM · emails                                                                                                                 | `notifications`  |
| `catalogs`      | [[Posiciones]] · [[Zonas]] · [[Niveles de Inglés]] · [[Departamentos del Hotel]] · [[Modalidades de Contratación]] · los 7 semáforos como datos                      | `catalogs`       |

> [!warning]
> **Hueco detectado.** D-01 no asigna módulo al **expediente del Colaborador** ni al flujo de [[Reclutamiento/Flujo de Reclutamiento\|Reclutamiento]] (fases 1–3, validación manual RR-07, [[Semáforo del Colaborador]], documentos). Aquí se aloja provisionalmente en `coverage/` —que ya contiene Pool y Blacklist— pero **la decisión está abierta**: la alternativa es un módulo `personal/` propio, y en ese caso serían 11 módulos. Resolver antes de escribir la primera migración.

> [!important]
> **El núcleo transaccional no se parte.** `demand → coverage → operations` corren en **una sola transacción de Postgres** (D-01): ocupar el slot, recalcular cobertura, recalcular el estado de la requisición, escribir el journal y generar el Schedule. Esa unión es una regla de negocio (RR-15), no un detalle de implementación. Los únicos candidatos a extraerse algún día son `notifications` y `supervision`.

> [!important]
> **El corte entre operación y dinero es un estado, no un módulo** (D-09). `operations` guarda la marca con su estado (`pendiente → aprobado` \| `rechazado`); `settlement` solo cuenta horas de marcas en `aprobado`. Pero `settlement` **no consulta `operations.punch_mark`**: pide las horas pagables al `index.ts` de `operations`, como manda la frontera de datos. Si el filtro por `aprobado` se escribe en dos módulos, en el primer cambio de la máquina de estados uno paga lo que el otro no.

### Fronteras entre módulos

| Nivel         | Cómo se separa                                                                             |
| ------------- | ------------------------------------------------------------------------------------------ |
| Código        | Un módulo llama a otro por su interfaz pública (`index.ts` del módulo), nunca a sus tablas |
| Base de datos | Un esquema Postgres por módulo. `demand` no hace `SELECT` sobre `settlement.invoice`       |
| Eventos       | Fuera del núcleo, vía Pub/Sub (D-03). Nunca en el camino de la asignación                  |

En Prisma esto se expresa con `multiSchema`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["identity", "commercial", "demand", "coverage",
              "operations", "settlement", "supervision", "journal",
              "notifications", "catalogs"]
}

model Requisition {
  // …
  @@map("requisition")
  @@schema("demand")
}
```

### Anatomía de un módulo

Cada uno de los 10 módulos agrupa **submódulos** —ahí viven las entidades— y expone una sola superficie pública. Ejemplo con `demand`:

```
modules/demand/
├── demand.module.ts
├── index.ts                           # única superficie pública del módulo
│
├── requisitions/
│   ├── requisitions.controller.ts
│   ├── requisitions.service.ts
│   ├── requisitions.repository.ts    # acceso a Prisma; el service no toca Prisma directo
│   ├── dto/
│   │   ├── create-requisition.dto.ts
│   │   ├── update-requisition.dto.ts
│   │   └── query-requisitions.dto.ts
│   ├── entities/
│   │   └── requisition.entity.ts      # forma de respuesta pública (no la fila de DB)
│   ├── guards/
│   │   └── requisition-owner.guard.ts
│   ├── events/
│   │   └── requisition-autorizada.event.ts
│   └── requisitions.service.spec.ts
│
├── positions/
└── slots/
```

> [!important]
> El `index.ts` del módulo es lo único que otro módulo puede importar. `coverage` no importa `demand/slots/slots.repository`: importa lo que `demand/index.ts` exporte. Es la frontera de código de D-01 llevada a una regla de ESLint.

**Reglas de capa:**

| Capa         | Sí hace                                                   | No hace                        |
| ------------ | --------------------------------------------------------- | ------------------------------ |
| `controller` | Rutas, validación de entrada vía DTO, códigos HTTP        | Lógica de negocio, consultas   |
| `service`    | Reglas de negocio, orquestación, transiciones de semáforo | SQL o llamadas Prisma directas |
| `repository` | Consultas Prisma, mapeo fila → entidad                    | Decidir reglas de negocio      |

### Llamada directa o evento

Esta es la regla que más se equivoca, y D-01 y D-03 la resuelven sin ambigüedad:

| Situación                                                                                                                          | Mecanismo                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| El efecto **debe** ser atómico con la operación (ocupar slot → recalcular cobertura → recalcular requisición → journal → Schedule) | **Llamada directa** dentro de la misma transacción, vía el `index.ts` del otro módulo |
| El efecto puede llegar segundos después (push, email, recálculo de urgencia, indicadores de QA)                                    | **Evento a Pub/Sub** (D-03), consumido por `notifications` o `supervision`            |

> [!warning]
> Meter el núcleo en el bus lo vuelve de consistencia eventual, y entonces _"gana el primero"_ (RR-15) deja de cumplirse. **`demand`, `coverage` y `operations` se llaman directo y comparten transacción.** El resto se comunica por eventos.

### Submódulos

Un módulo crece anidando submódulos, sin crear módulos nuevos en la raíz:

```
modules/commercial/
├── commercial.module.ts
├── index.ts
├── onboarding/                        # pipeline · propuestas · conversión
├── hoteles/
└── contracts/                         # contract · rates por posición
```

---

## 4. Estructura del frontend web (`apps/web`)

Organización **por feature**, no por tipo de archivo. La carpeta de feature coincide con el módulo del sidebar del rol (ver [[Estructura General App]]).

> [!note]
> Las features del web **no espejean** los 10 módulos del backend, y está bien: el backend se divide por frontera transaccional, la UI por lo que el rol ve en su sidebar. Una feature (`requisitions`) puede consumir dos módulos (`demand` y `coverage`).

```
apps/web/
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── app/                          # cableado global
│   │   ├── router.tsx
│   │   ├── providers.tsx             # <Provider store> + router
│   │   ├── store.ts                  # configureStore + middleware de RTK Query
│   │   ├── baseApi.ts                # createApi vacío: cada feature inyecta sus endpoints
│   │   └── hooks.ts                  # useAppDispatch / useAppSelector tipados
│   │
│   ├── shared/                       # reutilizable entre features
│   │   ├── components/               # solo lo atado al store, la ruta o el permiso (D-16)
│   │   ├── hooks/                    # useDebounce, useMediaQuery
│   │   ├── lib/                      # baseQuery con el token, formatters, guards
│   │   ├── types/
│   │   └── constants/
│   │
│   ├── layouts/
│   │   ├── AppShell.tsx              # sidebar + header + content
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   │
│   ├── features/
│   │   ├── requisitions/
│   │   ├── schedule/
│   │   ├── timesheet/
│   │   ├── workers/
│   │   ├── blacklist/
│   │   ├── work-accidents/
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── reportes/
│   │   ├── notifications/
│   │   └── perfil/
│   │
│   └── styles/
│       └── globals.css               # directivas de Tailwind + variables de tema
├── tailwind.config.ts                # extiende el preset de packages/ui
├── postcss.config.js
└── index.html
```

> [!warning]
> **Hueco detectado.** D-09 exige **dos** lugares que ningún sidebar del vault define todavía: uno donde el [[Hotel/Supervisor|Supervisor]] revise y resuelva las marcas anómalas, y otro donde el [[Hotel/Manager de Área|Manager de Área]] apruebe la jornada antes del corte semanal. [[00 - Arquitectura Supervisor|El wireframe del Supervisor]] lista `TIMESHEET` como **solo consulta**, y ni el del Manager de Área ni el del Manager General contemplan aprobar horas. Por eso esta lista no lleva carpeta para ello: el nombre de la feature lo fija el sidebar del rol, no este documento. Sin esos dos módulos, la semana no se puede cerrar.

### Anatomía de una feature

```
features/requisitions/
├── index.ts                          # única superficie pública de la feature
├── api/
│   └── requisitionsApi.ts           # baseApi.injectEndpoints — los hooks los genera RTK Query
├── store/
│   └── requisitionsSlice.ts         # solo estado de UI de la feature (filtros abiertos, selección)
├── components/
│   ├── RequisitionCard.tsx
│   ├── RequisitionTable.tsx
│   └── RequisitionForm.tsx
├── pages/
│   ├── RequisitionsListPage.tsx
│   └── RequisitionDetailPage.tsx
├── hooks/
│   └── useRequisitionFilters.ts
├── types/
│   └── requisition.types.ts
└── utils/
    └── calcularUrgencia.ts
```

> [!important]
> Una feature **solo se importa desde su `index.ts`**. Está prohibido `import { RequisitionCard } from '@/features/requisitions/components/RequisitionCard'` desde otra feature. Si dos features necesitan el mismo componente, ese componente sube a `shared/components/`.

### Estado

**Un solo store de Redux Toolkit**, con dos inquilinos que no se mezclan: la caché del servidor (RTK Query) y el estado de UI (slices).

| Tipo de estado                                    | Herramienta                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Datos del servidor                                | **RTK Query** — un `injectEndpoints` por feature; la caché es del store, no se copia a un slice |
| Estado global de UI (sesión, rol activo, sidebar) | **Slice de Redux Toolkit** — uno por dominio de UI, en `app/store.ts`                           |
| Estado de UI de una feature (filtros, selección)  | **Slice de la feature**, en `features/<x>/store/`                                               |
| Estado local de componente                        | `useState` / `useReducer` — no todo va al store                                                 |
| Formularios                                       | **React Hook Form** + **Zod** (mismo schema que el DTO del backend)                             |

> [!important]
> **Un solo `createApi`, endpoints inyectados.** `app/baseApi.ts` define la API vacía (baseQuery, `tagTypes`, reintentos) y cada feature agrega los suyos con `baseApi.injectEndpoints`. Si cada feature crea su propio `createApi`, se pierde la invalidación cruzada por tags —autorizar una requisición ya no refresca el Schedule— y aparecen tantas cachés como features.

> [!warning]
> **No copiar la respuesta del servidor a un slice.** Un `requisitions: []` dentro de un slice es la respuesta de ayer: RTK Query ya la tiene, con su estado de carga y su invalidación. Los slices guardan lo que el servidor no sabe: qué filtro está abierto, qué fila está seleccionada, qué rol tiene activo el usuario.

> [!note]
> Los hooks de RTK Query **se generan**, no se escriben: `useGetRequisitionsQuery`, `useAuthorizeRequisitionMutation`. No se renombran ni se envuelven en un `useRequisitions` propio salvo que agregue lógica real.

---

## 5. Estructura de la app móvil (`apps/mobile`)

React Native para el [[Colaborador/Colaborador|Colaborador]] y el [[Inspector]] (D-05). Misma organización por feature que el web; lo que cambia es que **el offline es un requisito, no una comodidad**: el colaborador poncha dentro de la propiedad —con GPS y foto, muchas veces sin señal— y el Inspector marca GPS en zona.

```
apps/mobile/
├── src/
│   ├── app/                          # navegación y providers
│   ├── features/
│   │   ├── punch/                   # GPS + foto de cámara + captura offline
│   │   ├── my-schedule/
│   │   ├── my-file/            # fases 2 y 3 del alta
│   │   ├── inspecciones/             # GPS en zone
│   │   └── accidents/
│   ├── offline/
│   │   ├── queueMarks.ts             # Firestore: marcas pendientes de enviar
│   │   └── queuePhotos.ts              # archivo local → Cloud Storage con URL firmada
│   ├── shared/
│   │   └── ui/                       # react-native-reusables copiado + composiciones móviles (D-16)
│   └── lib/
│       ├── firebase.ts               # Auth · FCM · Firestore
│       └── baseQuery.ts              # el mismo contract que el web, con el token de Firebase
├── tailwind.config.js                # mismo preset de packages/ui, vía NativeWind
└── app.json
```

El store también es Redux Toolkit, con una diferencia que importa: **RTK Query no reemplaza a la cola offline**. Su caché sirve para leer (Schedule, expediente); las marcas que el dispositivo no pudo enviar viven en `offline/` hasta que hay red.

> [!important]
> **Firestore es buzón, no fuente de verdad.** Guarda lo que el dispositivo no pudo enviar todavía; en cuanto hay red, eso viaja al backend y **Postgres decide**. Ningún cálculo de nómina, cobertura ni semáforo lee de Firestore. El backend tampoco lo consulta.

> [!warning]
> **Dos reglas que la app no puede romper** (D-08):
>
> 1. La app **no decide si el ponche es válido**. Manda coordenadas crudas y precisión; la geocerca la evalúa el backend. Un `inside_geofence` calculado en el teléfono es un control que no existe.
> 2. La foto se captura **solo desde la cámara**, nunca desde la galería, y no viaja por Firestore (tope de 1 MB por documento): se encola en el sistema de archivos y sube a Cloud Storage con URL firmada.

> [!note]
> El token lo emite Firebase Auth, pero **los permisos se resuelven en el backend** contra la tabla `permission` (D-05). La app no decide qué puede hacer el usuario leyendo claims del token.

> [!note]
> La app **muestra** el estado de la marca (`pendiente`, `revisado`, `aprobado`, `rechazado`) para que el colaborador sepa qué le van a pagar, pero no lo cambia: revisar es acción del [[Hotel/Supervisor|Supervisor]] y aprobar lo es del [[Hotel/Manager de Área|Manager de Área]] o del [[Hotel/Manager General|Manager General]], todas en el web (D-09).

---

## 6. Paquetes compartidos (`packages/`)

### `packages/domain`

Fuente de verdad **en código** de lo que el vault define como fuente de verdad **en documentación**. Sin dependencias, sin lógica de infraestructura.

```
packages/domain/src/
├── statusLights/
│   ├── workerStatusLight.ts
│   ├── requisitionStatusLight.ts
│   ├── positionCoverageStatusLight.ts
│   ├── urgencyStatusLight.ts
│   ├── onboardingStatusLight.ts
│   ├── qualityIndicator.ts
│   └── timesheetIndicator.ts
├── catalogs/
│   ├── positions.ts
│   ├── zones.ts
│   ├── englishLevels.ts
│   ├── hotelDepartments.ts
│   └── hiringModalities.ts
└── permissions/
    ├── roles.ts
    └── permissionMatrix.ts
```

Cada semáforo exporta sus estados **y** sus transiciones válidas, para que ninguna capa invente una transición:

```ts
// packages/domain/src/statusLights/requisitionStatusLight.ts
export const RequisitionStatusLight = {
  APPLE_GREEN: 'APPLE_GREEN', // Verde Manzana — En elaboración
  GREEN: 'GREEN', // Verde — Autorizada
  YELLOW: 'YELLOW', // Amarillo — En proceso
  LIGHT_BLUE: 'LIGHT_BLUE', // Azul Claro — Cubierta totalmente
  RED: 'RED', // Rojo — Cubierta parcialmente
  PURPLE: 'PURPLE', // Morado — Eliminada
} as const

export type RequisitionStatusLight =
  (typeof RequisitionStatusLight)[keyof typeof RequisitionStatusLight]

export const REQUISITION_TRANSITIONS: Record<
  RequisitionStatusLight,
  readonly RequisitionStatusLight[]
> = {
  APPLE_GREEN: ['GREEN', 'PURPLE'],
  GREEN: ['YELLOW', 'PURPLE'],
  YELLOW: ['LIGHT_BLUE', 'RED'],
  LIGHT_BLUE: [],
  RED: ['YELLOW'],
  PURPLE: [],
} as const
```

> [!important] El `code` en inglés, el nombre en español
> El identificador del estado va en inglés (`APPLE_GREEN`) y el color que ve el usuario sigue siendo _Verde Manzana_ — así lo fija **D-11**. El comentario de cada línea es esa correspondencia, y no es decorativo: es lo que permite leer este archivo junto a la nota del semáforo en el vault sin traducir de cabeza.
>
> **Lo que no cambia:** los seis estados, su significado y sus transiciones. Aquí solo cambió cómo se escribe el identificador.

> [!warning]
> Los valores de esta carpeta **se derivan del vault, no se inventan**. Cambiar un estado o una transición aquí exige actualizar antes la nota del semáforo correspondiente en `Core/Módulos/Semáforos/` y pasar por el subagente `semaforo-guardian`. El código nunca es la fuente de verdad del negocio.

### `packages/contracts`

DTOs y tipos de request/response compartidos. Define el contrato de la API una sola vez:

```
packages/contracts/src/
├── requisitions/
│   ├── createRequisition.schema.ts   # schema Zod
│   └── requisition.response.ts
├── workers/
└── common/
    ├── pagination.ts
    └── apiError.ts
```

El schema Zod se usa **en los tres lados**: el backend valida con él en el pipe, el web y el móvil validan sus formularios con el mismo objeto. Un solo lugar donde cambiar una regla de validación.

### `packages/ui`

Dos cosas con alcance distinto: el **preset de Tailwind** —que consumen web y móvil— y los **componentes web**.

```
packages/ui/
├── tokens.ts                 # única definición de los tokens Oranje en TS
├── tailwind-preset.ts        # theme en objeto JS para el config v3 del móvil
├── components.json           # config de la CLI de shadcn: escribe en src/components/ui/
└── src/
    ├── components/
    │   ├── ui/               # primitivas de shadcn copiadas — nombres de archivo de shadcn
    │   ├── SemaforoBadge.tsx # composiciones Oranje sobre las primitivas
    │   ├── KpiCard.tsx
    │   └── FlowStepper.tsx
    └── styles/
        ├── tokens.css        # los mismos tokens como @theme de Tailwind 4 — lo consume el web
        └── shadcn-vars.css   # variables de shadcn derivadas de los tokens
```

Los nombres de los tokens documentados en [[Convenciones de Diseño]] (`--o-500`, `--sb`, `--st-*`) **no se renombran**: `tokens.ts` los define y de ahí salen **dos emisiones** —`tokens.css` con `@theme` para el web en Tailwind 4, y `tailwind-preset.ts` como objeto para el config v3 del móvil— que exponen las mismas clases (`bg-o-500`, `w-sb`) en los dos lados.

> [!note]
> **Dos emisiones, una fuente** (enmienda de D-12). Tailwind 4 eliminó la configuración en JS y NativeWind estable todavía exige Tailwind 3, así que el preset dejó de poder ser un solo archivo compartido. Lo que la decisión protege —que un color de semáforo se defina una vez— lo sigue garantizando `tokens.ts`. Las dos emisiones se colapsan en una cuando NativeWind 5 sea estable.

**Las variables de shadcn son derivadas, no una segunda fuente** (D-16). `shadcn-vars.css` declara `--primary: var(--o-500)` y equivalentes; ningún componente copiado define un color propio. Los `--st-*` quedan fuera de ese mapeo a propósito: son la escala del semáforo, la consume `SemaforoBadge` y no tienen nada que hacer en `--primary`.

> [!important]
> **El preset es compartido; los componentes, no.** `apps/mobile` extiende `tailwind-preset.ts` a través de NativeWind y escribe las mismas clases, pero **no importa `src/components/`**: un `<Button>` web renderiza `<button>`, que no existe en React Native. Su equivalente es **react-native-reusables** copiado en `apps/mobile/src/shared/ui/`, con la misma API y otra implementación (D-16) — no se fuerza un componente único.

> [!note]
> **Dónde va cada componente.** Lo reutilizable entre features vive aquí; `apps/web/src/shared/components/` queda para lo que depende del store, del router o del permiso del usuario. Antes ambos listaban `Button, Modal, Table, StatusChip` sin decir cuál mandaba; la CLI de shadcn escribe en una sola ruta, así que la ambigüedad se cerró en D-16.

> [!note]
> **Excepción de nombrado, acotada a `src/components/ui/`.** Ahí los archivos conservan el `kebab-case` de shadcn (`button.tsx` exportando `Button`), contra la regla de §7.1, para que `shadcn diff` siga detectando cambios al actualizar. Fuera de esa carpeta —composiciones incluidas— rige §7.1: `PascalCase.tsx`.

> [!warning]
> `tokens.ts` es la **única** definición. Un color de semáforo escrito a mano en un `className` (`bg-[#e63946]`) rompe lo que el preset garantiza: que el rojo del [[Semáforo de Requisición]] sea el mismo en la tabla del web y en la tarjeta del móvil.

---

## 7. Nomenclatura

### 7.1 Tabla maestra

| Elemento                         | Convención                                                                      | Ejemplo                                                |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Carpetas**                     | `kebab-case`                                                                    | `work-accidents/`                                      |
| **Archivos NestJS**              | `kebab-case.type.ts`                                                            | `requisitions.service.ts`, `create-requisition.dto.ts` |
| **Componentes React**            | `PascalCase.tsx`                                                                | `RequisitionCard.tsx`                                  |
| **Hooks**                        | `camelCase.ts` con prefijo `use`                                                | `useRequisitionFilters.ts`                             |
| **Slices de Redux**              | `camelCase` + sufijo `Slice`                                                    | `sesionSlice.ts`, `requisitionsSlice.ts`               |
| **Endpoints de RTK Query**       | `camelCase` + sufijo `Api`                                                      | `requisitionsApi.ts`                                   |
| **Utilidades / servicios front** | `camelCase.ts`                                                                  | `requisitionsApi.ts`, `formatFecha.ts`                 |
| **Tipos / interfaces (archivo)** | `camelCase.types.ts`                                                            | `requisition.types.ts`                                 |
| **Tests**                        | archivo + `.spec.ts` (unit) / `.e2e-spec.ts` (e2e)                              | `requisitions.service.spec.ts`                         |
| **Clases**                       | `PascalCase`                                                                    | `RequisitionsService`, `CreateRequisitionDto`          |
| **Interfaces / types**           | `PascalCase`, sin prefijo `I`                                                   | `Requisition`, no `IRequisition`                       |
| **Variables y funciones**        | `camelCase`                                                                     | `activeRequisition`, `calcularUrgencia()`              |
| **Booleanos**                    | `camelCase` con prefijo `is/has/can/should`                                     | `isAutorizada`, `canEditar`                            |
| **Constantes**                   | `UPPER_SNAKE_CASE`                                                              | `MAX_POSITIONS_PER_REQUISITION`                        |
| **Enums (clave)**                | `UPPER_SNAKE_CASE`                                                              | `WorkerStatusLight.APPLE_GREEN`                        |
| **Modelos Prisma**               | `PascalCase` singular                                                           | `model Requisition`                                    |
| **Esquemas Postgres**            | nombre del módulo de D-01, `snake_case`                                         | `demand`, `settlement`                                 |
| **Tablas Postgres**              | `snake_case` **singular**, calificada por su esquema (vía `@@map` + `@@schema`) | `demand.requisition`, `supervision.work_accident`      |
| **Columnas Postgres**            | `snake_case` (vía `@map`)                                                       | `authorized_at`                                        |
| **Endpoints**                    | `kebab-case` plural                                                             | `GET /api/v1/work-accidents`                           |
| **Variables de entorno**         | `UPPER_SNAKE_CASE`                                                              | `DATABASE_URL`, `JWT_SECRET`                           |
| **Ramas Git**                    | `tipo/RF-X-NN-descripcion-corta`                                                | `feat/RF-H-05-authorize-requisition`                   |

> [!important]
> **`camelCase` es para identificadores dentro del código, no para nombres de archivo.** En NestJS los archivos van en `kebab-case` (convención oficial del framework y de su CLI); en React los componentes van en `PascalCase` porque el archivo se nombra igual que el componente que exporta. Mezclar estos tres criterios es el error de nombrado más común: la regla es **el archivo se nombra según lo que exporta**.

> [!note]
> **Una sola excepción:** `packages/ui/src/components/ui/`, donde las primitivas copiadas de shadcn conservan su `kebab-case` para no romper `shadcn diff` (D-16, §6). En cualquier otra carpeta el componente React va en `PascalCase.tsx`.

> [!note]
> **Tabla en singular, endpoint en plural.** No es incoherencia: la tabla nombra _una fila_ y ya viene calificada por su esquema (`demand.requisition`), como en D-01 y en [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]]; el endpoint nombra _una colección_ (`GET /api/v1/requisitions`), como manda REST.

### 7.2 Sufijos obligatorios en backend

| Sufijo                                                      | Qué es                          |
| ----------------------------------------------------------- | ------------------------------- |
| `.module.ts`                                                | Módulo Nest                     |
| `.controller.ts`                                            | Controlador HTTP                |
| `.service.ts`                                               | Lógica de negocio               |
| `.repository.ts`                                            | Acceso a datos                  |
| `.dto.ts`                                                   | Objeto de entrada validado      |
| `.entity.ts`                                                | Forma de salida pública         |
| `.guard.ts` / `.pipe.ts` / `.filter.ts` / `.interceptor.ts` | Elementos transversales de Nest |
| `.event.ts`                                                 | Evento de dominio               |

### 7.3 Prefijos de DTO

`Create…Dto`, `Update…Dto`, `Query…Dto`, `Response…Dto`. Nunca un DTO genérico reutilizado entre crear y editar: los campos obligatorios difieren.

### 7.4 Imports

Rutas absolutas con alias; prohibido `../../../`.

```ts
import { RequisitionsService } from '@/modules/requisitions/requisitions.service' // api
import { RequisitionCard } from '@/features/requisitions' // web
import { PunchScreen } from '@/features/punch' // mobile
import { RequisitionStatusLight } from '@oranje/domain' // paquete
```

Cada app define su propio `@/` en su `tsconfig` —apunta a su `src/`— y los tres consumen los paquetes compartidos por `@oranje/*`. Orden de imports (lo aplica ESLint, no se discute en review): externos → paquetes `@oranje/*` → internos `@/` → relativos → estilos.

### 7.5 Móvil (React Native)

Rige la misma regla que en el web —**el archivo se nombra según lo que exporta**— con cuatro elementos que solo existen aquí:

| Elemento          | Convención                                                      | Ejemplo                                         |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| **Pantallas**     | `PascalCase` + sufijo `Screen`                                  | `PunchScreen.tsx`, `MyScheduleScreen.tsx`       |
| **Navegadores**   | `PascalCase` + sufijo `Navigator`                               | `WorkerNavigator.tsx`, `InspectorNavigator.tsx` |
| **Estilos**       | `className` de NativeWind, con las clases del preset compartido | `className="bg-o-500 px-4"`                     |
| **Colas offline** | `camelCase.ts` con prefijo `queue`                              | `queueMarks.ts`, `queuePhotos.ts`               |

Lo demás no cambia: carpetas en `kebab-case` (`my-file/`), hooks con prefijo `use`, slices con sufijo `Slice`, componentes en `PascalCase.tsx`, tests en `.spec.tsx`, y una feature se importa **solo desde su `index.ts`**.

> [!note]
> **Mismas clases, componentes propios.** NativeWind hace que `className="bg-o-500"` funcione igual que en el web, pero `packages/ui/src/components/` sigue siendo solo web (§6). Y `StyleSheet.create` no está prohibido: queda para lo que Tailwind no expresa (animaciones, `shadow` por plataforma).

> [!important]
> El dominio también va en inglés aquí (§8): `PunchScreen`, no `PoncheScreen`; `WorkerNavigator`, no `ColaboradorNavigator`. La única cosa en español que sobrevive en el móvil son los nombres de los diez módulos cuando aparecen en una ruta de API.

---

## 8. Idioma del código

**Todo el dominio en inglés (D-11), sin excepciones.** Tablas, columnas, modelos, endpoints, ramas de Git **y los diez esquemas de Postgres**.

```ts
// Correcto
async function createRequisition(dto: CreateRequisitionDto): Promise<Requisition>
const availableWorkers = await this.repository.findByZone(zoneId)
if (requisition.statusLight === RequisitionStatusLight.YELLOW) { … }

// Incorrecto — medio identificador en cada idioma
async function createRequisicion(dto: CreateRequisicionDto): Promise<Requisicion>
const colaboradoresDisponibles = await this.repository.findByZona(zonaId)
```

### Por qué

Todo lo que rodea al dominio ya está en inglés: el framework, las librerías, las palabras de SQL, los verbos de HTTP, los comandos de Git. Con dominio en español, cada línea queda partida a la mitad — `await this.repository.findByZona(zonaId)` — y nadie recuerda qué mitad le toca a cada palabra.

Y el español del código nunca fue español: los identificadores no admiten acentos ni eñes, así que `Requisición` se escribe `Requisicion`. Una tercera ortografía que no existe ni en el vault ni en la conversación del equipo.

### El costo, y quién lo paga

**El glosario deja de ser cortesía y pasa a ser obligatorio.** Los IDs de requerimiento (`RF-H-05`, `RR-C-04`), las notas del vault y las juntas con Reclutamiento y Hotel siguen en español. Buscar `Requisición` en el código no encuentra nada, y el único puente es la tabla de aquí abajo.

Por eso: **quien agrega un concepto al dominio agrega su fila en el mismo PR.** Un concepto sin fila es un término que el siguiente va a traducir por su cuenta, y entonces hay dos nombres para la misma cosa.

> [!warning]
> **El Colaborador es `Worker`.** Decidido el 2026-08-06 (**D-11**); el idioma queda cerrado sin excepciones abiertas.
>
> `Employee` está descartado: el Colaborador **no es empleado del hotel**, y nombrarlo así en el código filtra una relación laboral que no existe y que el negocio cuida.
>
> Se evaluó dejarlo en español como excepción y se descartó: `colaborador` viviría **dentro** de `colaborador_id`, `getColaboradorById`, `availableColaboradores` — la palabra más frecuente del sistema, a media línea de las demás. Y desde el 2026-08-07 **no hay ninguna excepción de idioma en el código**: los esquemas también pasaron a inglés.
>
> **En el vault, en la UI y en las juntas sigue siendo Colaborador.** Nadie va a leer `Worker` en una pantalla.

### Glosario canónico

Un concepto del vault, un identificador en código. Es la **única traducción autorizada**: si un término no aparece aquí, no se traduce por criterio propio — se agrega la fila.

| Vault                      | Código                | Tabla Postgres (esquema.tabla)                                             |
| -------------------------- | --------------------- | -------------------------------------------------------------------------- |
| Colaborador                | `Worker`              | `coverage.worker`                                                          |
| Requisición                | `Requisition`         | `demand.requisition`                                                       |
| Posición de la Requisición | `Position`            | `demand.position`                                                          |
| Slot                       | `Slot`                | `demand.slot`                                                              |
| Asignación                 | `Assignment`          | `coverage.assignment`                                                      |
| Participación (Self-Pick)  | `Participation`       | `coverage.participation`                                                   |
| Semáforo                   | `StatusLight`         | `catalogs.status_light` · `status_light_state` · `status_light_transition` |
| Zona                       | `Zone`                | `catalogs.zone`                                                            |
| Hotel                      | `Hotel`               | `commercial.hotel`                                                         |
| Contrato                   | `Contract`            | `commercial.contract` · `contract_rate`                                    |
| Schedule                   | `Schedule`            | `operations.schedule`                                                      |
| Timesheet                  | `Timesheet`           | `operations.timesheet`                                                     |
| Ponche                     | `PunchMark`           | `operations.punch_mark`                                                    |
| Geocerca                   | `Geofence`            | columna de `commercial.hotel`                                              |
| Consolidado Semanal        | `WeeklyConsolidation` | `settlement.weekly_consolidation`                                          |
| Detalle del Consolidado    | `ConsolidationDetail` | `settlement.consolidation_detail` — una fila **por requisición** (D-10)    |
| Factura                    | `Invoice`             | `settlement.invoice`                                                       |
| Blacklist                  | `BlacklistEntry`      | `coverage.blacklist_entry`                                                 |
| Accidente Laboral          | `WorkAccident`        | `supervision.work_accident`                                                |
| Pool de Colaboradores      | `WorkerPool`          | — (vista sobre `coverage`)                                                 |
| Nivel de Inglés            | `EnglishLevel`        | `catalogs.english_level`                                                   |
| Modalidad de Contratación  | `HiringModality`      | `catalogs.hiring_modality`                                                 |

> [!warning]
> Los nombres de tabla de esta columna se toman de [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]]; el esquema, del mapa de módulos de la §3. Si alguno cambia allá, cambia aquí — este documento no es la fuente de verdad del esquema. La ubicación de `worker` depende del hueco señalado en la §3.

> [!note]
> Términos que ya son ingleses en el vault (`Schedule`, `Timesheet`, `Blacklist`, `Self-Pick`, `Onboarding`) **se dejan como están**. No se castellanizan.

---

## 9. Roles en código

Los roles se nombran con el ID del vault más su nombre, siguiendo la convención `ROL-[X]-[NN]` de la metodología de Arquitecturas:

```ts
// packages/domain/src/permissions/roles.ts
export const Rol = {
  // Hotel
  SUPERVISOR: 'ROL-H-01',
  MANAGER_AREA: 'ROL-H-02',
  MANAGER_GENERAL: 'ROL-H-03',
  // Ventas
  BD: 'ROL-V-01',
  BDC: 'ROL-V-02',
  // …
} as const
```

> [!warning]
> **Huecos detectados en el vault**, a resolver antes de codificar el RBAC:
>
> 1. `Arquitecturas/_Globales/Roles del Sistema.md` está **vacío**. Es el catálogo que debería listar todos los roles con su ID y es la fuente natural de este enum.
> 2. La Matriz de Permisos de Reclutamiento usa `ROL-01…ROL-05` (sin letra de departamento), mientras Hotel usa `ROL-H-xx` y Ventas `ROL-V-xx`. Hay que unificar a `ROL-[X]-[NN]` antes de fijar los identificadores en código.

> [!note]
> El enum es la **lista** de roles; los **permisos** no viven aquí ni en el token, sino en la tabla `identity.permission` (D-05 y [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]] §9). Agregar un permiso es un `INSERT`, no un despliegue.

---

## 10. Trazabilidad con las Decisiones de Arquitectura

Cada decisión de [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]] tiene una consecuencia física en el repositorio. Si una de estas dos columnas cambia, la otra también:

| Decisión                                                      | Dónde se ve en la estructura                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D-01** Monolito modular, un desplegable                     | `apps/api/src/modules/` con exactamente 10 módulos · un esquema Postgres por módulo · una sola imagen de contenedor                                                                                                                                                      |
| **D-02** Self-Pick con locks de fila                          | `modules/demand/slots/` + `modules/coverage/` en la misma transacción; sin cliente de Redis en `infra/`                                                                                                                                                                  |
| **D-03** Pub/Sub fuera del núcleo                             | `infra/pubsub/` solo lo usan `notifications` y `supervision`                                                                                                                                                                                                             |
| **D-04** Sin API Gateway                                      | No hay `apps/gateway`; `apps/web` es artefacto estático detrás del Load Balancer                                                                                                                                                                                         |
| **D-05** Firebase para móvil                                  | `apps/mobile/` · `infra/firebase/` en el backend · `offline/` con Firestore                                                                                                                                                                                              |
| **D-06** Un proyecto de GCP por ambiente                      | `infra/` con la definición de `oranje-dev`, `oranje-staging` y `oranje-prod`                                                                                                                                                                                             |
| **D-07** Observabilidad y secretos desde el día uno           | `infra/secrets/` (Secret Manager y cifrado de campo) y logging estructurado en `common/interceptors/`                                                                                                                                                                    |
| **D-08** Ponche validado en el servidor                       | La geocerca se evalúa en `modules/operations/`; la app solo captura. Fotos a Cloud Storage vía `infra/storage/`, nunca por Firestore                                                                                                                                     |
| **D-09** Solo el ponche aprobado paga                         | El estado de la marca vive en `modules/operations/`; `settlement` pide las horas pagables por el `index.ts` de `operations` · el permiso de aprobar es una fila de `identity.permission` acotada al hotel, no un rol · falta la feature de validación en `apps/web` (§4) |
| **D-10** Overtime por requisición                             | `modules/settlement/` desglosa el consolidado **por requisición** (`consolidation_detail`), no por hotel; el vínculo sale de `assignment → slot → position → requisition`                                                                                                |
| **D-12** Redux Toolkit con RTK Query, Tailwind con NativeWind | Un solo `store.ts` y un solo `baseApi.ts` por cliente, con endpoints inyectados por feature · `tailwind-preset.ts` compartido y `src/components/` de `packages/ui` solo para web                                                                                         |
| **D-16** La librería de componentes se copia                  | `packages/ui/components.json` + `src/components/ui/` (shadcn) · `apps/mobile/src/shared/ui/` (react-native-reusables) · `shadcn-vars.css` derivado de `tokens.ts`, nunca al revés                                                                                        |
| **D-17** Router, gráficas y mapa                              | `apps/web/src/app/router.tsx` con `createBrowserRouter` de `react-router` (sin framework mode, D-04) · Recharts en las features con dashboard · `@vis.gl/react-google-maps` en la feature de territorio, con la API key restringida por referrer                         |

---

## Anexo: por qué no repositorios separados

**D-01 ya cerró esta variante:** _"un repositorio"_. Se documenta el costo que evita, para no reabrir la discusión sin datos.

Si se separaran `oranje-api`, `oranje-web` y `oranje-mobile`:

| Tema                  | Qué costaría                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Semáforos y catálogos | Publicar `@oranje/domain` como paquete npm privado desde un cuarto repo, con su propio versionado y release |
| Contratos             | Generar el cliente desde el OpenAPI del backend en CI para no escribir tipos a mano                         |
| Design system         | `oranje-seed.css` en un paquete propio, con el mismo problema de versionado                                 |
| Cambios de negocio    | Tres PRs coordinados; el backend despliega primero y sostiene compatibilidad hacia atrás una versión        |
| Estructura interna    | Idéntica: `apps/api/src/…` pasa a ser `src/…` en cada repo                                                  |

> [!warning]
> Con repos separados, **duplicar los enums de semáforos a mano no es aceptable**. Sin paquete compartido ni generación desde OpenAPI, la divergencia entre backend y clientes es cuestión de semanas — y un estado de semáforo divergente es un cálculo de cobertura equivocado, no un detalle cosmético.

---

## Relacionado

- [[Arquitecturas/_Globales/Decisiones de Arquitectura|Decisiones de Arquitectura]] — D-01 … D-16, las decisiones que esta estructura materializa
- [[Arquitecturas/_Globales/Modelo de Datos|Modelo de Datos]] — esquema, entidades e invariantes
- [[Estándares de Desarrollo]]
- [[Estándares de Base de Datos]] — convenciones de Postgres, migraciones y crecimiento
- [[Estructura General App]]
- [[Convenciones de Diseño]]
- [[Roles del Sistema]]
- [[Reglas de Negocio]]
- [[_GUIA - Plantilla de Arquitectura de Departamento]]
- [[Índice de Arquitecturas]]
