/**
 * La ubicación por la vía NATIVA, solo dentro de la app (`@capacitor/geolocation`,
 * instalado en `apps/mobile`).
 *
 * Por qué: en iOS, `navigator.geolocation` dentro del WKWebView tiene su PROPIO
 * permiso por sitio, aparte del que la persona ya dio a la app en la pantalla
 * nativa de Permisos — el ponche volvía a preguntar «… quiere usar tu
 * ubicación». La vía nativa usa el permiso de la app y no pregunta de nuevo.
 *
 * Igual que `nativePermissions.ts`: no se importa `@capacitor/*` (el web no
 * depende de Capacitor); se habla con el `window.Capacitor` que inyecta el
 * WebView. En el navegador el plugin no existe, `hasNativeGeolocation()` es
 * `false` y todo sigue por `navigator.geolocation`, exactamente como antes.
 */

const PLUGIN = 'Geolocation'

/** Permiso negado o restringido (códigos del plugin, iguales en iOS y Android). */
const DENIED_CODES: ReadonlySet<string> = new Set(['OS-PLUG-GLOC-0003', 'OS-PLUG-GLOC-0008'])

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  isPluginAvailable?: (name: string) => boolean
  nativePromise: <T>(plugin: string, method: string, options?: object) => Promise<T>
}

interface NativePosition {
  coords: { latitude: number; longitude: number }
}

function bridge(): CapacitorBridge | null {
  const cap = (window as { Capacitor?: CapacitorBridge }).Capacitor
  if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.(PLUGIN)) return null
  return cap
}

export function hasNativeGeolocation(): boolean {
  return bridge() !== null
}

function isDenied(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && DENIED_CODES.has(code)
}

/**
 * La posición actual por la vía nativa. Falla con los mismos nombres que la
 * versión web del ponche (`GEOLOCATION_DENIED` / `GEOLOCATION_FAILED`), así
 * que quien la llama no distingue de dónde vino.
 */
export async function nativeCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  const cap = bridge()
  if (!cap) throw new Error('GEOLOCATION_UNSUPPORTED')
  try {
    const position = await cap.nativePromise<NativePosition>(PLUGIN, 'getCurrentPosition', {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    })
    return { latitude: position.coords.latitude, longitude: position.coords.longitude }
  } catch (error) {
    throw new Error(isDenied(error) ? 'GEOLOCATION_DENIED' : 'GEOLOCATION_FAILED', {
      cause: error,
    })
  }
}

/** El permiso de ubicación de la APP: lo pide si falta, con el diálogo del sistema. */
export async function requestNativeLocationPermission(): Promise<
  'granted' | 'denied' | 'prompt' | 'unsupported'
> {
  const cap = bridge()
  if (!cap) return 'unsupported'
  try {
    const status = await cap.nativePromise<{ location?: string }>(PLUGIN, 'requestPermissions', {
      permissions: ['location'],
    })
    return status.location === 'granted'
      ? 'granted'
      : status.location === 'denied'
        ? 'denied'
        : 'prompt'
  } catch (error) {
    return isDenied(error) ? 'denied' : 'unsupported'
  }
}
