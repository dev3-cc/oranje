# Oranje — monorepo

Plataforma de gestión organizacional para staffing de hoteles. Este repositorio
es **el código**; la fuente de verdad del negocio vive en el vault de Obsidian
`oranje-matrix-system` y **no se duplica aquí** (Estándares de Desarrollo §10).

## Arrancar

```bash
pnpm install
cp .env.example .env        # y llena los valores
pnpm -F @oranje/api dev
```

Requiere **Node 22+** y **pnpm**. No mezclar con npm ni yarn.

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

| Comando          | Qué hace                            |
| ---------------- | ----------------------------------- |
| `pnpm lint`      | ESLint en todo el workspace         |
| `pnpm typecheck` | `tsc --noEmit` en todo el workspace |
| `pnpm test`      | Tests                               |
| `pnpm build`     | Build de todos los paquetes         |
| `pnpm format`    | Prettier en escritura               |

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

| Qué                                             | Por qué                                                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 6**, no 7                          | `typescript-eslint` no soporta TS 7 todavía, y el linter es obligatorio (§9). Fijado con `overrides` en `pnpm-workspace.yaml` |
| **`eslint-plugin-import-x`**                    | El `eslint-plugin-import` original truena con ESLint 10                                                                       |
| **Prisma 7**: la URL vive en `prisma.config.ts` | Prisma 7 la quitó del `schema.prisma`                                                                                         |
| Sin `baseUrl` en tsconfig                       | TypeScript 7 lo eliminó; las rutas van relativas al archivo que las declara                                                   |

## Qué falta

El estado y el orden de las tareas están en el vault:
`Arquitecturas/_Globales/Plan de Implementación - Base de Datos.md`.

Fase 1 (esto) está lista. Lo siguiente es la **migración #1**:
`catalogs` → `identity` → `commercial`.
