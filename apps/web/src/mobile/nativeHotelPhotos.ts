/**
 * Las fotos de hotel (`places.googleapis.com`) en la app de iOS, por el HTTP
 * NATIVO y con el referrer de la web.
 *
 * Por qué: la foto lleva la llave del navegador de Google, restringida por
 * referrer a `https://mi.oranjepeople.com`. En iOS el origen de la app es
 * `capacitor://mi.oranjepeople.com` (WKWebView no deja servir `https` como
 * esquema propio) y Google responde 403 `API_KEY_HTTP_REFERRER_BLOCKED`: la
 * foto no se ve. Un `<img>` no puede cambiar su referrer, pero una petición
 * nativa sí. Aquí cada foto de Google se baja así y se entrega como `blob:`.
 *
 * Se intercepta en un solo lugar, para todas las pantallas del web que la app
 * consume sin tocarlas: `setAttribute('src')` (lo que usa React) y la
 * propiedad `src` (lo que usa el Avatar de Radix al probar la imagen con un
 * `new Image()` antes de dibujarla).
 *
 * Solo en iOS (o en Android con el mismo interruptor de diagnóstico que
 * `nativeApiFetch`). El web no lo carga: vive en `mobile/` y se instala desde
 * `mobile/main.tsx`.
 */

const PHOTO_HOST = 'https://places.googleapis.com/'

/** Para diagnosticar en Android: `localStorage['oranje.nativeApiFetch'] = 'on'`. */
const FORCE_FLAG = 'oranje.nativeApiFetch'

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  isPluginAvailable?: (name: string) => boolean
  nativePromise: <T>(plugin: string, method: string, options?: object) => Promise<T>
}

interface NativeHttpResponse {
  status: number
  headers: Record<string, unknown>
  data: unknown
}

function isForced(): boolean {
  try {
    return window.localStorage.getItem(FORCE_FLAG) === 'on'
  } catch {
    return false
  }
}

export function isHotelPhoto(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(PHOTO_HOST)
}

/** Base64 (Android lo parte en renglones) → `Blob`. */
function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}

/**
 * Baja una foto por el HTTP nativo con el referrer de la web y devuelve su
 * `blob:`. Exportada para sus pruebas.
 */
export function createPhotoLoader(
  cap: CapacitorBridge,
  referrer: string,
): (url: string) => Promise<string> {
  const cache = new Map<string, Promise<string>>()

  return (url) => {
    const cached = cache.get(url)
    if (cached) return cached

    const pending = cap
      .nativePromise<NativeHttpResponse>('CapacitorHttp', 'request', {
        url,
        method: 'GET',
        headers: { Referer: referrer },
        responseType: 'blob',
      })
      .then((response) => {
        if (response.status !== 200 || typeof response.data !== 'string') {
          throw new Error(`foto ${String(response.status)}`)
        }
        const contentType = response.headers['content-type']
        const blob = base64ToBlob(
          response.data,
          typeof contentType === 'string' ? contentType : 'image/jpeg',
        )
        return URL.createObjectURL(blob)
      })
    /* Un fallo no se queda en caché: la siguiente vez se reintenta. */
    pending.catch(() => cache.delete(url))
    cache.set(url, pending)
    return pending
  }
}

export function installNativeHotelPhotos(): void {
  const cap = (window as { Capacitor?: CapacitorBridge }).Capacitor
  if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.('CapacitorHttp')) return
  if (cap.getPlatform?.() !== 'ios' && !isForced()) return

  /* El mismo host que la web: `capacitor://mi.oranjepeople.com` → `https://mi.oranjepeople.com/`. */
  const load = createPhotoLoader(cap, `https://${window.location.host}/`)

  /* Los originales del navegador: se guardan para llamarlos con `.call` desde el parche. */
  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  // eslint-disable-next-line @typescript-eslint/unbound-method -- se invoca con `.call(this, …)`
  const setAttribute = Element.prototype.setAttribute
  if (!srcDescriptor?.set || !srcDescriptor.get) return
  // eslint-disable-next-line @typescript-eslint/unbound-method -- se invoca con `.call(image, …)`
  const setSrc = srcDescriptor.set
  // eslint-disable-next-line @typescript-eslint/unbound-method -- se invoca con `.call(this)`
  const getSrc = srcDescriptor.get

  /** Mientras baja, la imagen queda vacía; al llegar, recibe su `blob:`. */
  const swap = (image: HTMLImageElement, url: string): void => {
    image.dataset.nativePhoto = url
    load(url)
      .then((blobUrl) => {
        /* Si mientras tanto le pusieron otra foto, esta ya no aplica. */
        if (image.dataset.nativePhoto === url) setSrc.call(image, blobUrl)
      })
      .catch(() => {
        if (image.dataset.nativePhoto === url) setSrc.call(image, url)
      })
  }

  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: srcDescriptor.enumerable ?? true,
    get(this: HTMLImageElement) {
      return getSrc.call(this) as string
    },
    set(this: HTMLImageElement, value: string) {
      if (isHotelPhoto(value)) swap(this, value)
      else setSrc.call(this, value)
    },
  })

  Element.prototype.setAttribute = function (this: Element, name: string, value: string): void {
    if (this instanceof HTMLImageElement && name.toLowerCase() === 'src' && isHotelPhoto(value)) {
      swap(this, value)
      return
    }
    setAttribute.call(this, name, value)
  }
}
