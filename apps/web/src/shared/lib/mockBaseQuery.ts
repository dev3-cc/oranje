import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'

/**
 * Capa de mocks para RTK Query mientras `apps/api` no expone los endpoints.
 *
 * Envuelve el `baseQuery` real: si `VITE_USE_MOCKS` está activo, resuelve la
 * petición contra las rutas registradas; si no, la deja pasar intacta. Las
 * features NO saben que existe — declaran su endpoint con su URL y su método
 * definitivos, y el día que el backend exista solo se apaga la bandera.
 *
 * Se hace a mano y no con MSW a propósito: agregar una dependencia obligaría a
 * modificar el `pnpm-lock.yaml` de la raíz, y el acuerdo es no salir de
 * `apps/web`.
 */

/** Origen ficticio: `new URL` necesita uno para parsear rutas relativas. */
const MOCK_ORIGIN = 'http://mock.oranje.local'

/**
 * Latencia artificial. Sin ella los estados de carga nunca se ven y se cuelan
 * bugs de skeleton. En tests va en cero: los flujos compuestos (alta = hotel +
 * contacto + prospecto + refetch) encadenan varias llamadas y con 420ms cada
 * una el `findBy*` de Testing Library se agota antes de que pinte.
 */
const MOCK_LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 420

export type MockMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface MockRequest {
  /** Segmentos dinámicos de la ruta: `/prospects/:prospectId` -> `{ prospectId }`. */
  readonly params: Readonly<Record<string, string>>
  readonly search: URLSearchParams
  readonly body: unknown
}

export interface MockRoute {
  readonly method: MockMethod
  /** Plantilla con segmentos dinámicos, p. ej. `/prospects/:prospectId/status`. */
  readonly path: string
  readonly resolve: (request: MockRequest) => unknown
}

interface CompiledRoute extends MockRoute {
  readonly matcher: RegExp
  readonly paramNames: readonly string[]
}

const compiledRoutes: CompiledRoute[] = []

export const isMockEnabled = import.meta.env.VITE_USE_MOCKS === 'true'

/** `/prospects/:prospectId/status` -> `/^\/prospects\/([^/]+)\/status$/` + `['prospectId']`. */
function compileRoute(route: MockRoute): CompiledRoute {
  const paramNames: string[] = []
  const pattern = route.path
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      paramNames.push(segment.slice(1))
      return '([^/]+)'
    })
    .join('/')

  return { ...route, matcher: new RegExp(`^${pattern}$`), paramNames }
}

/**
 * Registra las rutas simuladas de una feature. Se llama al importar su archivo
 * de mocks; fuera de modo mock no hace nada, así los fixtures no llegan a
 * producción por descuido.
 */
export function registerMockRoutes(routes: readonly MockRoute[]): void {
  if (!isMockEnabled) return
  for (const route of routes) compiledRoutes.push(compileRoute(route))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** RTK Query manda o la URL suelta o un `FetchArgs`; aquí se normalizan a lo mismo. */
function normalizeArgs(args: string | FetchArgs): { url: URL; method: MockMethod; body: unknown } {
  if (typeof args === 'string') {
    return { url: new URL(args, MOCK_ORIGIN), method: 'GET', body: undefined }
  }

  const url = new URL(args.url, MOCK_ORIGIN)
  for (const [key, value] of Object.entries(args.params ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }

  return { url, method: (args.method?.toUpperCase() as MockMethod) ?? 'GET', body: args.body }
}

function toMockError(status: number, message: string): { error: FetchBaseQueryError } {
  return { error: { status, data: { message } } }
}

/**
 * Envuelve el baseQuery real. Devuelve el original tal cual cuando los mocks
 * están apagados: en producción esta función es un paso-through sin costo.
 */
export function withMocks<Args extends string | FetchArgs, Result, Error>(
  baseQuery: BaseQueryFn<Args, Result, Error>,
): BaseQueryFn<Args, Result, Error> {
  if (!isMockEnabled) return baseQuery

  return async (args, _api, _extraOptions) => {
    const { url, method, body } = normalizeArgs(args)

    /**
     * Gana la ruta con menos segmentos dinámicos: `/requisitions/authorizations`
     * y `/requisitions/:requisitionId` casan las dos con la misma URL, y sin
     * este desempate mandaría la que se hubiera registrado primero —es decir, el
     * orden de los imports— y la cola de autorización respondería «no existe la
     * requisición authorizations».
     */
    const compiled = compiledRoutes
      .filter((route) => route.method === method && route.matcher.test(url.pathname))
      .sort((a, b) => a.paramNames.length - b.paramNames.length)[0]

    // Sin mock declarado NO se cae al backend real: enmascararía el olvido con
    // un error de red confuso. Mejor decir exactamente qué ruta falta.
    if (!compiled) {
      return toMockError(
        501,
        `No hay mock para ${method} ${url.pathname}. Regístralo en el archivo de mocks de su feature.`,
      ) as ReturnType<BaseQueryFn<Args, Result, Error>>
    }

    const matched = compiled.matcher.exec(url.pathname) ?? []
    const params = Object.fromEntries(
      compiled.paramNames.map((name, index) => [
        name,
        decodeURIComponent(matched[index + 1] ?? ''),
      ]),
    )

    await delay(MOCK_LATENCY_MS)

    try {
      const data = compiled.resolve({ params, search: url.searchParams, body })
      return { data } as ReturnType<BaseQueryFn<Args, Result, Error>>
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error en el mock'
      return toMockError(400, message) as ReturnType<BaseQueryFn<Args, Result, Error>>
    }
  }
}
