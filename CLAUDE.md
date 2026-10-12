# Oranje — guía para Claude

Monorepo pnpm: `apps/web` (React + Vite + RTK Query + Lingui), `apps/api` (NestJS + Prisma),
`apps/mobile` (Capacitor sobre el bundle del web), `packages/{ui,config,contracts,domain}`.
Los estándares completos están en `Oranje - Estándares/` y `docs/`: **léelos por sección
(`grep -n "^##"` y luego `sed -n`), nunca completos**.

## Ahorro de contexto (obligatorio)

- **No leas completos** estos archivos; busca con `grep -n` y lee el rango con `sed -n`:
  - `apps/web/src/locales/*/messages.po` (~470 KB cada uno)
  - `pnpm-lock.yaml` (~600 KB)
  - `apps/web/CHANGELOG.md` (~110 KB): para agregar una entrada basta leer las primeras ~40 líneas.
  - `apps/web/src/assets/**` (imágenes y JSON de animaciones).
- Los artefactos de build (`dist/`, `dist-mobile/`, `apps/mobile/android/**/assets/public`,
  `build/`) están en `.gitignore`: no los abras ni los formatees.
- Recorta la salida de comandos largos (`| tail -20`, `| grep -E "error|FAIL"`).
- Para búsquedas amplias usa un subagente y pide solo la conclusión.
- Un tema por sesión: al cambiar de tarea, `/clear`.

## Comandos

Si `pnpm` no está en el PATH, usa `corepack pnpm`.

| Qué              | Comando                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Web local        | `pnpm -F @oranje/web dev` (o `exec vite --mode staging`)                                                   |
| Tipos (web)      | `pnpm -F @oranje/web typecheck`                                                                            |
| Lint (web)       | `pnpm -F @oranje/web lint` — en local puede quedarse sin memoria: `NODE_OPTIONS=--max-old-space-size=6144` |
| Pruebas acotadas | `pnpm -F @oranje/web exec vitest run <ruta>`                                                               |
| Formato          | `pnpm exec prettier --check <archivos>`                                                                    |
| Textos (Lingui)  | `pnpm -F @oranje/web i18n:extract`                                                                         |
| Bundle de la app | `pnpm -F @oranje/web build:mobile` y luego `cap sync android` en `apps/mobile`                             |

El CI (`.github/workflows/ci.yml`) corre, en orden: `format:check`, `lint`, `typecheck`,
`test` y `build` de todo el monorepo.

## Commits

- Conventional Commits. Tipos válidos: `feat fix refactor perf test docs chore build ci`
  (**`style` no existe**). Sujeto sin mayúscula inicial ni punto final; encabezado ≤ 72 caracteres.
- lint-staged solo formatea `ts/tsx` (ESLint + Prettier) y `json/md/yml`. **Los `.html` y
  otros no se formatean solos**: pásales `prettier --write` antes del commit o fallará el CI.
- Las ramas de trabajo entran a `staging` por PR. Al hacer merge de `staging` en una rama,
  revisa los conflictos de `apps/web/src/app/router.tsx` (ver «Rutas»).

## Reglas que no se ven en el código

- **Bitácora:** todo cambio en `apps/web` lleva una entrada en `apps/web/CHANGELOG.md` en el
  mismo commit. Va arriba, bajo `## AAAA-MM-DD`, con el formato
  `### HH:MM — Título` / `**Qué:**` / `**Por qué:**` / `**Archivos:**`. Es append-only.
- **Textos (Lingui):** todo texto visible va con `t`/`Trans`/`msg`. Después de
  `i18n:extract`, traduce en `src/locales/en/messages.po` **solo** las entradas nuevas
  (`grep -n -A1 'msgstr ""'`) y no toques las que no son tuyas.
- **Features:** una feature solo se importa por su `index.ts`; `apps/*` nunca importa de otro `apps/*`.
- **Rutas:** las del staff (shell, módulos, QR) viven en `apps/web/src/app/staffRoutes.tsx` y las
  comparten el web (`app/router.tsx`) y la app (`src/mobile/router.tsx`). **No declares rutas
  del shell en `router.tsx`.** La app nunca importa `app/router.tsx`.
- **App móvil:** la app consume las pantallas del web tal cual; lo único solo de la app vive en
  `apps/web/src/mobile/` y no cambia nada del web. El web nunca importa `@capacitor/*`: habla
  con el `window.Capacitor` que inyecta el WebView (ver `features/worker/lib/nativeGeolocation.ts`).
  Detalles de iOS en `apps/mobile/CLAUDE.md`.
- **Orígenes de la app:** Android `https://mi.oranjepeople.com`, iOS `capacitor://mi.oranjepeople.com`.
  Con `capacitor://`, `new URL(...).origin` vale `"null"`: compara esquema y host.
- **API desde local:** staging acepta CORS de `http://localhost:5173` (no de `127.0.0.1`);
  producción no acepta orígenes locales.
