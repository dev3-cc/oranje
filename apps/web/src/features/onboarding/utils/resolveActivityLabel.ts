import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { ProspectSummary } from '../types/prospect.types'

/**
 * Tercera línea de la tarjeta del tablero: qué fue lo último que pasó.
 *
 * En VERDE lo relevante es la propuesta que se envió, no la llamada previa —
 * es lo que distingue esa columna. En el resto de estados manda el último
 * intento de contacto, y si no hay ninguno se dice explícitamente: una tarjeta
 * sin actividad es justo la que hay que atender.
 *
 * `i18n` viene de quien la llama (`useLingui`): así el texto habla el idioma
 * activo (D-36).
 */
export function resolveActivityLabel(prospect: ProspectSummary, i18n: I18n): string {
  if (prospect.status === 'GREEN' && prospect.latestProposalVersion !== null) {
    return i18n._(msg`Propuesta v${prospect.latestProposalVersion}`)
  }

  if (prospect.lastAttempt) {
    return `${prospect.lastAttempt.channel} · ${prospect.lastAttempt.outcome}`
  }

  return i18n._(msg`Sin intentos`)
}
