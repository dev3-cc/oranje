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
