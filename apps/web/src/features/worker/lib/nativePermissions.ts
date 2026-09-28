/**
 * El puente con la pantalla NATIVA de Permisos de la app del Colaborador
 * (`apps/mobile`: `OranjePermissionsPlugin` en Android). Esa pantalla dice si
 * hay permiso de ubicación, si el GPS está encendido y si hay permiso de
 * cámara, y los pide o manda a la configuración del teléfono.
 *
 * No se importa `@capacitor/core`: el web no depende de Capacitor y en el
 * navegador nada de esto existe. Se habla con el `window.Capacitor` que el
 * WebView inyecta —`nativePromise` y `nativeCallback` son lo que el propio
 * `@capacitor/core` usa por debajo—. Fuera de la app, `hasNativePermissions()`
 * es `false` y todo lo demás responde `null` sin tocar nada.
 */

const PLUGIN = 'OranjePermissions'

/**
 * `granted` concedido · `prompt` falta y se puede pedir · `denied` falta y solo
 * se activa desde la configuración del teléfono · `approximate` (ubicación en
 * Android 12+) hay permiso, pero sin precisión la geocerca puede fallar.
 */
export type NativePermissionState = 'granted' | 'prompt' | 'denied' | 'approximate'

export interface NativePermissions {
  location: NativePermissionState
  camera: NativePermissionState
  /** El interruptor de ubicación del teléfono, aparte del permiso de la app. */
  gps: boolean
  /** Todo lo que el ponche necesita está listo: ubicación precisa, GPS y cámara. */
  ready: boolean
}

/**
 * Cómo se cerró la pantalla: «Ponchar», «Ir a Inicio», o `back` —el botón
 * Atrás de Android—, que solo cierra y deja a la persona donde estaba.
 */
export interface PermissionsScreenResult extends NativePermissions {
  action: 'punch' | 'home' | 'back'
}

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  isPluginAvailable?: (name: string) => boolean
  nativePromise: <T>(plugin: string, method: string, options?: object) => Promise<T>
  nativeCallback: (
    plugin: string,
    method: string,
    options: object,
    callback: (data: unknown) => void,
  ) => string
}

function bridge(): CapacitorBridge | null {
  const cap = (window as { Capacitor?: CapacitorBridge }).Capacitor
  if (!cap?.isNativePlatform?.() || !cap.isPluginAvailable?.(PLUGIN)) return null
  return cap
}

/** Estamos dentro de la app y su pantalla nativa de Permisos existe. */
export function hasNativePermissions(): boolean {
  return bridge() !== null
}

export async function checkNativePermissions(): Promise<NativePermissions | null> {
  const cap = bridge()
  return cap ? cap.nativePromise<NativePermissions>(PLUGIN, 'check') : null
}

/** Abre la pantalla nativa; resuelve al cerrarla. */
export async function openNativePermissions(options: {
  firstName: string
  locale: string
}): Promise<PermissionsScreenResult | null> {
  const cap = bridge()
  return cap ? cap.nativePromise<PermissionsScreenResult>(PLUGIN, 'open', options) : null
}

/**
 * Avisa cada vez que la app vuelve al frente —de Configuración, de la pantalla
 * de Permisos— con el estado nuevo. Devuelve cómo dejar de escuchar.
 */
export function onNativePermissionsChange(
  listener: (permissions: NativePermissions) => void,
): () => void {
  const cap = bridge()
  if (!cap) return () => undefined
  const eventName = 'permissionsChanged'
  const callbackId = cap.nativeCallback(PLUGIN, 'addListener', { eventName }, (data) => {
    if (data) listener(data as NativePermissions)
  })
  return () => {
    void cap.nativePromise(PLUGIN, 'removeListener', { eventName, callbackId })
  }
}
