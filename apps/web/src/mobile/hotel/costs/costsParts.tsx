import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { CostGap } from './costsContract'

/** Lo que falta, en palabras de quien lo lee. */
export const COST_GAP_LABEL: Record<CostGap, MessageDescriptor> = {
  NO_ACTIVE_CONTRACT: msg`El hotel no tiene un contrato activo con tarifas.`,
  POSITION_WITHOUT_RATE: msg`Una posición no tiene tarifa en el contrato: sus horas no tienen costo.`,
  UNAPPROVED_HOURS: msg`Hay horas sin aprobar: el monto puede cambiar.`,
  UNREVIEWED_ANOMALIES: msg`Hay días con anomalía sin revisar.`,
}

/**
 * Dólares con separador de miles: `1234.5` → `$1,234.50`. El `formatMoney`
 * compartido es para tarifas (`$185.00`) y no agrupa miles; un total semanal
 * de cinco cifras se lee mal sin coma.
 */
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function costMoney(amount: number): string {
  return USD.format(amount)
}

/** `"1234.5"` → `$1,234.50`; `null` → «—». */
export function moneyOf(value: string | null): string {
  return value === null ? '—' : costMoney(Number(value))
}

/** Minutos → «38.5 h». */
export function hoursOf(minutes: number): string {
  return `${String(Math.round((minutes / 60) * 10) / 10)} h`
}

/** El aviso de que lo que se ve es ficticio: mientras el backend no publica `/hotel-costs`. */
export function SampleNotice(): ReactNode {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl border border-dashed border-o-500/60 bg-o-50 p-3 text-sm text-o-900"
    >
      <MaterialIcon name="science" className="text-lg" aria-hidden />
      <span>
        <Trans>
          Datos de ejemplo: así se verán tus costos cuando el cálculo esté disponible. Los números
          no son reales.
        </Trans>
      </span>
    </p>
  )
}

export function IncompleteBadge(): ReactNode {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow/25 px-2 py-0.5 text-xs font-semibold text-ink">
      <MaterialIcon name="info" className="text-sm" aria-hidden />
      <Trans>Información incompleta</Trans>
    </span>
  )
}

/** La lista de por qué está incompleto; nada si está completo. */
export function GapList({ gaps }: { gaps: CostGap[] }): ReactNode {
  const { i18n } = useLingui()
  if (gaps.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 text-xs text-ink-2">
      {gaps.map((gap) => (
        <li key={gap} className="flex items-start gap-1.5">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-yellow" />
          {i18n._(COST_GAP_LABEL[gap])}
        </li>
      ))}
    </ul>
  )
}
