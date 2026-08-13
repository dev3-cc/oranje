# Oranje — monorepo

Plataforma de gestión organizacional para staffing de hoteles. Este repositorio
es **el código**; la fuente de verdad del negocio vive en el vault de Obsidian
`oranje-matrix-system` y **no se duplica aquí** (Estándares de Desarrollo §10).

## Arrancar

```bash
pnpm install
cp .env.example apps/api/.env      # el API lee SU .env, no el de la raíz

pnpm db:proxy                      # en otra terminal: la base vive en Cloud SQL
pnpm -F @oranje/api dev

curl localhost:3000/api/v1/health/db
```

Requiere **Node 22+** y **pnpm**. No mezclar con npm ni yarn.

La base **no es local**: está en Cloud SQL y se llega por el Cloud SQL Auth
Proxy. El paso a paso, la contraseña que falta y los errores típicos están en
[docs/base-de-datos.md](docs/base-de-datos.md).

## Estructura

```
apps/
  api/        NestJS — monolito modular, los 10 módulos de D-01, un solo desplegable
  web/        React + Vite — pendiente
  mobile/     React Native — pendiente
packages/
  domain/     Semáforos, catálogos y Matriz de Permisos. No importa de nadie
  contracts/  DTOs y tipos compartidos api <-> web <-> mobile
  ui/         Preset de Tailwind con los tokens Oranje + componentes web
  config/     ESLint, Prettier y presets de tsconfig compartidos
infra/        IaC por ambiente
docs/         ADRs y documentación técnica
```

**Regla de dependencias:** `packages/*` nunca importa de `apps/*`, y `apps/*`
nunca importa de otro `apps/*`. Lo que compartan, sube a `packages/`.

## Comandos

| Comando            | Qué hace                                            |
| ------------------ | --------------------------------------------------- |
| `pnpm lint`        | ESLint en todo el workspace                         |
| `pnpm typecheck`   | `tsc --noEmit` en todo el workspace                 |
| `pnpm test`        | Tests                                               |
| `pnpm build`       | Build de todos los paquetes                         |
| `pnpm format`      | Prettier en escritura                               |
| `pnpm db:proxy`    | Cloud SQL Auth Proxy en `localhost:5433`            |
| `pnpm db:status`   | ¿Faltan migraciones por aplicar?                    |
| `pnpm db:migrate`  | Crea y aplica una migración desde `schema.prisma`   |
| `pnpm db:deploy`   | Aplica las pendientes sin crear ninguna (CI y prod) |
| `pnpm db:studio`   | Prisma Studio                                       |
| `pnpm db:generate` | Regenera el cliente de Prisma                       |

## Autenticación

**Firebase dice quién eres; nuestro JWT dice qué puedes hacer.** El cliente hace
login con Firebase, manda ese ID token una sola vez, y a partir de ahí usa el
token de Oranje en cada request.

| Endpoint                       | Qué hace                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| `POST /api/v1/auth/session`    | Crear sesión. Entra el ID token de Firebase, sale el nuestro |
| `POST /api/v1/auth/refresh`    | Renovar. Rota el refresh: el anterior queda muerto           |
| `POST /api/v1/auth/logout`     | Matar esta sesión                                            |
| `POST /api/v1/auth/logout-all` | Matar todas las sesiones del usuario. Exige token            |

El **access token dura 15 minutos** y viaja en `Authorization: Bearer`. El
**refresh dura 7 días** y viaja en cookie `httpOnly` — nunca en el body, nunca en
`localStorage`. De él solo guardamos el SHA-256: si se filtra la tabla, lo
filtrado no sirve para entrar.

**El guard es global**: una ruta nueva nace protegida. Para abrirla, `@Public()`.

```ts
@Get()
list(@CurrentUser() user: AuthenticatedUser) {
  // user.id es NUESTRO id, no el uid de Firebase
  // user.hotelId + user.departmentId son el alcance
}
```

> El guard valida **identidad**, no permisos. La Matriz (`identity.role_permission`)
> está sembrada en cero, así que el guard de autorización todavía no existe.

## Ambientes

**El interruptor es `APP_ENV`, no `NODE_ENV`.** Jest pone `NODE_ENV=test` por su
cuenta; si de eso dependieran las llaves de firma, correr los tests exigiría
material criptográfico. Son dos cosas distintas.

| `APP_ENV`    | Dónde                             | Se arranca con       |
| ------------ | --------------------------------- | -------------------- |
| `local`      | Tu máquina                        | `pnpm dev`           |
| `staging`    | `oranje-staging` (rama `staging`) | `pnpm start:staging` |
| `production` | `oranje-prod` (rama `main`)       | `pnpm start:prod`    |

Es **un solo artefacto**: el build no cambia entre ambientes, solo las variables.

|                    | `local`                       | `staging` y `production`               |
| ------------------ | ----------------------------- | -------------------------------------- |
| Firma del token    | **HS256**, secreto compartido | **RS256**, par de llaves               |
| Autenticación      | Se puede **apagar**           | Obligatoria — el arranque lo verifica  |
| Firebase           | Emulador, sin verificar firma | Emisor real; localhost queda prohibido |
| Cookie del refresh | Puede ir sin HTTPS            | `secure` obligatorio                   |
| CORS               | Abierto                       | Lista blanca obligatoria               |
| Rate limit         | Alto, para que no estorbe     | El del ambiente                        |

**Un despliegue mal configurado no arranca.** La validación de entorno tumba el
proceso con el detalle de qué falta, en vez de dejar la API abierta:

```
Configuración de entorno inválida:
  JWT_PRIVATE_KEY: obligatoria en staging (RS256)
  COOKIE_SECURE: debe ser true en staging: la cookie viaja por HTTPS
  CORS_ORIGINS: obligatoria en staging: §6 pide lista blanca explícita
  AUTH_ISSUER_URL: apunta al emulador de Firebase, que no verifica firmas
```

### Por qué asimétrico fuera de local

Con **HS256 el que verifica puede firmar**: el secreto es el mismo. Mientras solo
la API emite y valida, da igual. En cuanto la llave tiene que salir del servicio
—otro consumidor, un job, una revisión— deja de ser aceptable.

Con **RS256 la privada solo existe donde se emiten tokens** y quien verifique
necesita únicamente la pública. Genera el par con:

```bash
pnpm -F @oranje/api auth:keys
```

**Cada ambiente lleva su propio par.** Con llave compartida, un token de staging
valdría en producción. La privada vive en Secret Manager (D-07), nunca en el repo.

### Trabajar sin Firebase

Mientras no exista el proyecto de Firebase, en local se puede apagar la
autenticación por completo:

```bash
AUTH_DISABLED=true
AUTH_DEV_USER_EMAIL=dev@oranje.local
```

Todo request entra como ese usuario, **que tiene que existir en `identity.user`**
— así el rol y el alcance con los que trabajas son los mismos que en la nube, no
unos inventados. Si `APP_ENV` no es `local`, la app **no arranca** con esto.

## Cómo se escribe un endpoint

```ts
// packages/contracts — el schema es UNO y lo comparten api, web y móvil
export const createProspectSchema = z.object({ hotelId: z.uuid() })

// apps/api
export class CreateProspectDto extends createZodDto(createProspectSchema) {}

@Controller('prospects')
export class ProspectController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  create(@Body() dto: CreateProspectDto) {
    // dto ya viene validado: el pipe global lo rechazó antes de llegar aquí
    return this.prisma.prospect.create({ data: { id: uuidv7(), ...dto } })
  }
}
```

Tres cosas que el andamio ya resuelve y no hay que repetir:

- **Validación** — `ZodValidationPipe` es global. Un `@Body()` tipado con un DTO
  de Zod se valida solo; lo que no es DTO de Zod pasa sin tocarse.
- **Errores** — todos salen con la misma forma, `{ error: { code, message, traceId } }`
  (Estándares de Desarrollo §4). El `code` es `UPPER_SNAKE_CASE` y estable: el
  frontend decide con él, nunca con el `message`.
- **Base de datos** — inyectas `PrismaService`. El `id` lo pones tú, con
  `uuidv7()`: no hay `DEFAULT` en la llave primaria.

## Los 10 módulos

Cada uno es una carpeta de `apps/api/src/modules/` **y** un esquema de Postgres
con el mismo nombre. Un módulo no consulta las tablas de otro: pide por su
`index.ts`.

`identity` · `commercial` · `demand` · `coverage` · `operations` ·
`settlement` · `supervision` · `journal` · `notifications` · `catalogs`

> [!] `demand → coverage → operations` corren en **una sola transacción de
> Postgres**. Esa unión es una regla de negocio (RR-15), no un detalle de
> implementación: no se separan.

## Decisiones fijadas en la herramienta

| Qué                                                 | Por qué                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 6**, no 7                              | `typescript-eslint` no soporta TS 7 todavía, y el linter es obligatorio (§9). Fijado con `overrides` en `pnpm-workspace.yaml`           |
| **`eslint-plugin-import-x`**                        | El `eslint-plugin-import` original truena con ESLint 10                                                                                 |
| **Prisma 7**: la URL vive en `prisma.config.ts`     | Prisma 7 la quitó del `schema.prisma`                                                                                                   |
| Sin `baseUrl` en tsconfig                           | TypeScript 7 lo eliminó; las rutas van relativas al archivo que las declara                                                             |
| **Driver adapter** de Prisma (`@prisma/adapter-pg`) | Prisma 7 ya no abre la conexión solo. Por eso el pool se configura en `PrismaService` y no en la URL                                    |
| **Zod en el pipe global**, no `ValidationPipe`      | `ValidationPipe` exige `class-validator`: sería escribir cada regla dos veces, porque el web y el móvil ya validan con el schema de Zod |
| `tsBuildInfoFile` dentro de `dist`                  | Con el cache fuera y `deleteOutDir: true`, el build salía "Done" con un `dist` a medias                                                 |

## Qué falta

El estado y el orden de las tareas están en el vault:
`Arquitecturas/_Globales/Plan de Implementación - Base de Datos.md`.

Hecho: el andamio, la migración #1 (`catalogs` → `identity` → `commercial`) y la
capa de conexión. **Lo siguiente es el seed** — `prisma/seed.ts` todavía lanza un
error a propósito, y sin los estados y transiciones sembrados el semáforo no
camina.
