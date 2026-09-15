import type { ProposalVersionSummary } from '../types/proposal.types'

import { formatMoney } from '@/shared/lib/formatters'

/**
 * El cuadro de tarifas resumido en una línea para las listas: cuántos puestos
 * y desde qué tarifa se factura. El cuadro completo vive en la vista previa,
 * que es la que se imprime.
 *
 * Las versiones anteriores al cuadro solo tienen la tarifa global: se muestran
 * como estaban, sin fingir que tenían puestos.
 */
export function summarizeRates(version: ProposalVersionSummary): string {
  if (version.rates.length === 0) {
    return `pay ${formatMoney(version.payRate)} · bill ${formatMoney(version.billRate)}`
  }

  const cheapest = Math.min(...version.rates.map((rate) => rate.billRate))

  return version.rates.length === 1
    ? `${version.rates[0]?.positionName ?? ''} · bill ${formatMoney(cheapest)}`
    : `${String(version.rates.length)} puestos · desde ${formatMoney(cheapest)} el bill`
}
