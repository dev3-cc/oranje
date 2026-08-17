import type { ProspectSummary } from '../types/prospect.types'

/**
 * Tercera línea de la tarjeta del tablero: qué fue lo último que pasó.
 *
 * En VERDE lo relevante es la propuesta que se envió, no la llamada previa —
 * es lo que distingue esa columna. En el resto de estados manda el último
 * intento de contacto, y si no hay ninguno se dice explícitamente: una tarjeta
 * sin actividad es justo la que hay que atender.
 */
export function resolveActivityLabel(prospect: ProspectSummary): string {
  if (prospect.status === 'VERDE' && prospect.latestProposalVersion !== null) {
    return `Propuesta v${prospect.latestProposalVersion}`
  }

  if (prospect.lastAttempt) {
    return `${prospect.lastAttempt.channel} · ${prospect.lastAttempt.outcome}`
  }

  return 'Sin intentos'
}
