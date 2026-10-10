import { msg } from '@lingui/core/macro'
import { toast } from '@oranje/ui'

import { i18n } from '@/app/i18n'

/**
 * Las descargas dentro de la app: «Descargar QR» del hotel.
 *
 * En el WebView de la app el botón no hacía nada, por dos razones:
 *
 *   1. La tarjeta del hotel abre la hoja del QR con `target="_blank"`. En iOS,
 *      Capacitor manda esa liga a `UIApplication.open` con un URL
 *      `capacitor://…` que no lleva a ningún lado; en Android recargaba toda la
 *      app. Aquí una liga a otra ventana DEL MISMO ORIGEN se abre en la misma
 *      app, con el router.
 *   2. `jsPDF.save()` descarga con un `<a download>` sobre un `blob:`, y el
 *      WebView no descarga nada. Pero jsPDF usa `window.saveAs` si existe: aquí
 *      se define para escribir el archivo con `@capacitor/filesystem` y
 *      entregarlo a la hoja de compartir del sistema (`@capacitor/share`) —
 *      «Guardar en Archivos», imprimir, AirDrop, WhatsApp, Drive…
 *
 * El web no lo carga: vive en `mobile/` y se instala desde `mobile/main.tsx`.
 * Sin los plugins (una app vieja) no hace nada.
 */

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  isPluginAvailable?: (name: string) => boolean
  nativePromise: <T>(plugin: string, method: string, options?: object) => Promise<T>
}

/** El blob en base64, sin el prefijo `data:…;base64,`. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('No se pudo leer el archivo'))
    }
    reader.readAsDataURL(blob)
  })
}

/** Cerrar la hoja de compartir sin elegir nada no es un error. */
function isShareCanceled(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && /cancel/i.test(message)
}

/**
 * Escribe el archivo en la caché de la app y abre la hoja de compartir con él.
 * Exportada para sus pruebas.
 */
export async function saveFileNatively(
  cap: CapacitorBridge,
  blob: Blob,
  fileName: string,
): Promise<void> {
  const { uri } = await cap.nativePromise<{ uri: string }>('Filesystem', 'writeFile', {
    path: fileName,
    data: await blobToBase64(blob),
    directory: 'CACHE',
  })
  try {
    await cap.nativePromise('Share', 'share', { title: fileName, files: [uri] })
  } catch (error) {
    if (!isShareCanceled(error)) throw error
  }
}

/**
 * La ruta interna de una liga, o `null` si sale del origen de la app. Se
 * comparan esquema y host, no `URL.origin`: para `capacitor://` (un esquema
 * no especial, el de iOS) `origin` vale `"null"`.
 */
export function sameOriginPath(href: string, origin: string): string | null {
  let url: URL
  let base: URL
  try {
    base = new URL(origin)
    url = new URL(href, base)
  } catch {
    return null
  }
  if (url.protocol !== base.protocol || url.host !== base.host) return null
  return `${url.pathname}${url.search}${url.hash}`
}

export function installNativeDownloads(navigate: (path: string) => void): void {
  const cap = (window as { Capacitor?: CapacitorBridge }).Capacitor
  if (!cap?.isNativePlatform?.()) return

  /* 1. Las ligas a otra ventana del mismo origen, dentro de la app. */
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return
      const anchor = event.target.closest('a[target="_blank"]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return
      const path = sameOriginPath(anchor.href, window.location.href)
      if (path === null) return
      event.preventDefault()
      navigate(path)
    },
    true,
  )

  /* 2. Lo que se «descarga» con `saveAs` (jsPDF), a la hoja de compartir. */
  if (!cap.isPluginAvailable?.('Filesystem') || !cap.isPluginAvailable?.('Share')) return
  ;(window as { saveAs?: (blob: Blob, fileName: string) => void }).saveAs = (blob, fileName) => {
    saveFileNatively(cap, blob, fileName).catch(() => {
      toast.error(i18n._(msg`No se pudo guardar el archivo. Inténtalo de nuevo.`))
    })
  }
}
