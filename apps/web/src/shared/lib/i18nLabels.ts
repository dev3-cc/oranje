import { i18n } from '@lingui/core'
import type { MessageDescriptor } from '@lingui/core'

/**
 * Un mapa `código → texto` que habla el idioma activo (D-36).
 *
 * Los mapas de etiquetas (`WORKER_STATUS_LABEL[code]`) se leen en decenas de
 * pantallas como strings. Para no cambiar a todos los consumidores, el mapa
 * conserva su forma —`Record<code, string>`— pero cada entrada es un getter
 * que traduce AL LEER, así que un cambio de idioma en caliente se refleja en
 * la siguiente lectura sin que nadie tenga que saber de Lingui.
 */
export function labelMap<K extends string>(
  messages: Record<K, MessageDescriptor>,
): Record<K, string> {
  const map = {} as Record<K, string>
  for (const key of Object.keys(messages) as K[]) {
    Object.defineProperty(map, key, {
      enumerable: true,
      get: () => i18n._(messages[key]),
    })
  }
  return map
}
