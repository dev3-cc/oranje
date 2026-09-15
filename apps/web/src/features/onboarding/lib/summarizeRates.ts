import type { I18n } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'

import type { ProposalVersionSummary } from '../types/proposal.types'

import { formatMoney } from '@/shared/lib/formatters'

/**
 * El cuadro de tarifas resumido en una línea para las listas: cuántos puestos
 * y desde qué tarifa se factura. El cuadro completo vive en la vista previa,
 * que es la que se imprime.
 *
 * Las versiones anteriores al cuadro solo tienen la tarifa global: se muestran
 * como estaban, sin fingir que tenían puestos.
 *
 * `i18n` viene de quien la llama (`useLingui`): así el texto habla el idioma
 * activo (D-36).
 */
export function summarizeRates(version: ProposalVersionSummary, i18n: I18n): string {
  if (version.rates.length === 0) {
    return i18n._(msg`pay ${formatMoney(version.payRate)} · bill ${formatMoney(version.billRate)}`)
  }

  const cheapest = Math.min(...version.rates.map((rate) => rate.billRate))

  if (version.rates.length === 1) {
    return i18n._(msg`${version.rates[0]?.positionName ?? ''} · bill ${formatMoney(cheapest)}`)
  }

  return i18n._(
    msg`${plural(version.rates.length, { one: '# puesto', other: '# puestos' })} · desde ${formatMoney(cheapest)} el bill`,
  )
}
