/**
 * Lectura ÚNICA del error de la API (§4 de Estándares de Desarrollo): el back
 * siempre responde `{ error: { code, message, details } }`, y el mock local
 * `{ message }`. Todo formulario pinta la causa REAL por esta puerta — el
 * «inténtalo de nuevo» a ciegas fue dos veces bug (el HEIC y la fecha futura).
 */

export interface ApiErrorInfo {
  /** HTTP, o el literal de RTK (`FETCH_ERROR`, `PARSING_ERROR`) si no hubo respuesta. */
  status: number | string | undefined
  code: string | undefined
  message: string | undefined
  details: Array<{ field?: string; message?: string; value?: unknown }>
}

/** Extrae lo que la API dijo, venga del contrato real o del mock. */
export function readApiError(error: unknown): ApiErrorInfo {
  const raw = error as
    | {
        status?: number | string
        data?: {
          message?: string
          error?: {
            code?: string
            message?: string
            details?: Array<{ field?: string; message?: string; value?: unknown }>
          }
        }
      }
    | undefined

  return {
    status: raw?.status,
    code: raw?.data?.error?.code,
    message: raw?.data?.error?.message ?? raw?.data?.message,
    details: raw?.data?.error?.details ?? [],
  }
}

/**
 * El mensaje para el usuario, por prioridad:
 * 1. el override por código (`byCode`) — para decir además QUÉ hacer;
 * 2. el override por status (`byStatus`) — p. ej. el 409 de RR-15;
 * 3. lo que el backend redactó (su `message` ya viene en español);
 * 4. los estatus comunes, con su causa;
 * 5. el `fallback`, que es lo único que puede ser genérico.
 */
export function apiErrorMessage(
  error: unknown,
  options?: {
    byCode?: Record<string, string | ((info: ApiErrorInfo) => string)>
    byStatus?: Record<number, string>
    fallback?: string
  },
): string {
  const info = readApiError(error)

  const codeOverride = info.code ? options?.byCode?.[info.code] : undefined
  if (codeOverride) {
    return typeof codeOverride === 'function' ? codeOverride(info) : codeOverride
  }

  if (typeof info.status === 'number' && options?.byStatus?.[info.status]) {
    return options.byStatus[info.status] as string
  }

  /*
   * El 403 del API dice «Tu rol no puede create en proposals»: es el guard
   * hablando en códigos. Aquí se traduce a algo que una persona entiende;
   * quién SÍ puede lo dice cada pantalla con su `byStatus[403]`.
   */
  if (info.status === 403 && (!info.message || /^Tu rol no puede /.test(info.message))) {
    return 'Esta acción no está en tu rol. Si la necesitas, pídesela a quien sí la tiene.'
  }

  if (info.message) return info.message

  if (info.status === 403) return 'Esta acción no está en tu rol.'
  if (info.status === 404) return 'Eso ya no existe: alguien lo movió o lo borró.'
  if (info.status === 413) return 'El archivo es demasiado grande para el servidor.'
  if (info.status === 'FETCH_ERROR') {
    return 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.'
  }

  return options?.fallback ?? 'No se pudo completar la acción. Inténtalo de nuevo.'
}
