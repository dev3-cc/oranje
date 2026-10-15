/**
 * En iOS, las peticiones al API salen por el HTTP NATIVO (`CapacitorHttp`), no
 * por el WKWebView. Solo en la app de iOS y solo hacia el API; Firebase, las
 * fotos y todo lo demás siguen por el WebView.
 *
 * Por qué: en iOS el origen de la app es `capacitor://mi.oranjepeople.com` (ver
 * `apps/mobile/CLAUDE.md` §3) y la cookie del refresh (`oranje_refresh`,
 * `httpOnly` y `Secure`, del dominio `run.app`) queda como cookie de TERCERO,
 * que WKWebView no guarda. El login entraba, pero a los 15 minutos el refresh
 * fallaba y la app mandaba al login. Por el HTTP nativo la cookie vive en
 * `HTTPCookieStorage` de iOS y viaja sola en el siguiente `/auth/refresh`.
 * Además, la petición nativa no pasa por CORS.
 *
 * Por qué no `plugins.CapacitorHttp.enabled` en `capacitor.config.ts`: activa el
 * parche en Android también —que hoy funciona— y su `fetch` parcheado convierte
 * mal el cuerpo cuando recibe un `Request` (lo que usa RTK Query): lee el stream,
 * lo pasa por `TextDecoder` y la foto del ponche llega corrupta. Aquí el
 * `FormData` se rearma y viaja como `formData`, que el lado nativo sí arma bien
 * (`CapacitorUrlRequest.getRequestDataFromFormData`).
 *
 * Se instala en `mobile/main.tsx`, antes de montar nada. No toca ni el web ni
 * `app/baseApi.ts`: RTK Query llama al `fetch` global en cada petición, y ese
 * es el que se reemplaza aquí.
 */

interface NativeHttpResponse {
  status: number
  headers: Record<string, unknown>
  data: unknown
}

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  isPluginAvailable?: (name: string) => boolean
  nativePromise: <T>(plugin: string, method: string, options?: object) => Promise<T>
}

/** Una entrada del `FormData` como la espera el lado nativo. */
type NativeFormEntry =
  | { key: string; value: string; type: 'string' }
  | { key: string; value: string; type: 'base64File'; contentType: string; fileName: string }

/** El `Content-Type` de una subida; el boundary lo pone el lado nativo. */
export const MULTIPART = 'multipart/form-data'

/** Para diagnosticar en Android: `localStorage['oranje.nativeApiFetch'] = 'on'`. */
const FORCE_FLAG = 'oranje.nativeApiFetch'

function isForced(): boolean {
  try {
    return window.localStorage.getItem(FORCE_FLAG) === 'on'
  } catch {
    return false
  }
}

export function installNativeApiFetch(apiUrl: string | undefined): void {
  const cap = (window as { Capacitor?: CapacitorBridge }).Capacitor
  if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.('CapacitorHttp')) return
  if (cap.getPlatform?.() !== 'ios' && !isForced()) return
  if (!apiUrl?.startsWith('http')) return

  const apiOrigin = new URL(apiUrl).origin
  const webFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    if (new URL(request.url).origin !== apiOrigin) return webFetch(input, init)
    return nativeFetch(cap, request)
  }
}

async function nativeFetch(cap: CapacitorBridge, request: Request): Promise<Response> {
  const method = request.method.toUpperCase()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  let data: unknown
  let dataType: string | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      data = await toNativeFormData(await request.formData())
      dataType = 'formData'
      /*
       * Sin boundary: el lado nativo arma el suyo y corrige el encabezado
       * (`overrideContentType`). NO se borra: `setRequestBody` solo arma el
       * cuerpo si hay `Content-Type`, y sin él la subida salía VACÍA (el API
       * respondía «Los datos enviados no son válidos»).
       */
      headers['content-type'] = MULTIPART
    } else {
      const text = await request.text()
      if (text) data = text
    }
  }

  let response: NativeHttpResponse
  try {
    response = await cap.nativePromise<NativeHttpResponse>('CapacitorHttp', 'request', {
      url: request.url,
      method,
      headers,
      data,
      dataType,
      responseType: 'text',
    })
  } catch (error) {
    /* Como `fetch`: sin respuesta es un TypeError (RTK lo reporta como FETCH_ERROR). */
    throw new TypeError(error instanceof Error ? error.message : 'Network request failed', {
      cause: error,
    })
  }

  const hasBody = method !== 'HEAD' && ![204, 205, 304].includes(response.status)
  const body = !hasBody
    ? null
    : typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data ?? null)

  const responseHeaders = new Headers()
  for (const [key, value] of Object.entries(response.headers)) {
    if (typeof value === 'string') responseHeaders.set(key, value)
    else if (typeof value === 'number' || typeof value === 'boolean') {
      responseHeaders.set(key, String(value))
    }
  }

  return new Response(body, { status: response.status, headers: responseHeaders })
}

/** Exportada para sus pruebas; fuera de este archivo nadie la necesita. */
export async function toNativeFormData(formData: FormData): Promise<NativeFormEntry[]> {
  const entries: NativeFormEntry[] = []
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      entries.push({ key, value, type: 'string' })
    } else {
      entries.push({
        key,
        value: await toBase64(value),
        type: 'base64File',
        contentType: value.type || 'application/octet-stream',
        fileName: value.name || 'file',
      })
    }
  }
  return entries
}

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('No se pudo leer el archivo'))
    }
    reader.readAsDataURL(file)
  })
}
