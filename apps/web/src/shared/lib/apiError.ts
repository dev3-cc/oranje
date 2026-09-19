/**
 * Lectura ÚNICA del error de la API (§4 de Estándares de Desarrollo): el back
 * siempre responde `{ error: { code, message, details } }`, y el mock local
 * `{ message }`. Todo formulario pinta la causa REAL por esta puerta — el
 * «inténtalo de nuevo» a ciegas fue dos veces bug (el HEIC y la fecha futura).
 */

import { i18n } from '@/app/i18n'
import { CONTRACT_STATUS_LABEL } from '@/shared/constants/contractStatus'
import { ONBOARDING_STATUS_LABEL } from '@/shared/constants/onboardingStatus'
import { REQUISITION_STATUS_LABEL } from '@/shared/constants/requisitionStatus'
import { TIMESHEET_WEEK_STATUS_LABEL } from '@/shared/constants/timesheetStatus'
import { WORKER_STATUS_LABEL } from '@/shared/constants/workerStatus'

/**
 * Siglas que SÍ son lenguaje de la persona: no son códigos y no se tocan.
 * Todo lo demás en mayúsculas sostenidas (`YELLOW`, `PENDING_APPROVAL`) es un
 * identificador que se coló al texto, y el texto entero se descarta.
 */
const HUMAN_ACRONYMS = new Set([
  'SSN',
  'ITIN',
  'QR',
  'GPS',
  'PDF',
  'API',
  'URL',
  'IANA',
  'ROL',
  'RFC',
  'CURP',
  'IMSS',
  'USD',
  'MXN',
  'IVA',
])

/**
 * Los códigos que el backend puede dejar caer en un mensaje y su palabra.
 * El mismo código significa cosas distintas por semáforo (YELLOW es «En
 * proceso» en Requisición y «Disp. voluntario» en el Colaborador), así que
 * solo se traducen los que no chocan; los ambiguos se tratan como fuga.
 */
/** Se arma por idioma y al usarse (D-36): los mapas traducen al leer. */
const CODE_LABEL_BY_LOCALE = new Map<string, Record<string, string>>()

function codeLabels(): Record<string, string> {
  const cached = CODE_LABEL_BY_LOCALE.get(i18n.locale)
  if (cached) return cached
  const merged: Record<string, string> = {}
  const clashes = new Set<string>()
  for (const map of [
    TIMESHEET_WEEK_STATUS_LABEL,
    CONTRACT_STATUS_LABEL,
    REQUISITION_STATUS_LABEL,
    WORKER_STATUS_LABEL,
    ONBOARDING_STATUS_LABEL,
  ] as Array<Record<string, string>>) {
    for (const [code, label] of Object.entries(map)) {
      if (code in merged && merged[code] !== label) clashes.add(code)
      merged[code] ??= label
    }
  }
  for (const code of clashes) delete merged[code]
  CODE_LABEL_BY_LOCALE.set(i18n.locale, merged)
  return merged
}

/**
 * Un mensaje del backend solo llega a la pantalla si habla como una persona:
 * los códigos conocidos y sin ambigüedad se traducen; si queda uno en
 * mayúsculas sostenidas, el mensaje se descarta y manda el `fallback`.
 * Es la puerta que garantiza la regla «ningún código en texto humano».
 */
export function humanizeApiMessage(message: string): string | null {
  const translated = message.replace(
    /\b[A-Z][A-Z_]{2,}\b/g,
    (token) => codeLabels()[token] ?? token,
  )
  const leak = translated.match(/\b[A-Z][A-Z_]{2,}\b/g)?.find((token) => !HUMAN_ACRONYMS.has(token))
  return leak ? null : translated
}

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
 * 3. lo que el backend redactó, si no trae códigos (ver `humanizeApiMessage`);
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

  if (info.message) {
    const human = humanizeApiMessage(info.message)
    if (human) return human
  }

  if (info.status === 403) return 'Esta acción no está en tu rol.'
  if (info.status === 404) return 'Eso ya no existe: alguien lo movió o lo borró.'
  if (info.status === 413) return 'El archivo es demasiado grande para el servidor.'
  if (info.status === 'FETCH_ERROR') {
    return 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.'
  }

  return options?.fallback ?? 'No se pudo completar la acción. Inténtalo de nuevo.'
}
