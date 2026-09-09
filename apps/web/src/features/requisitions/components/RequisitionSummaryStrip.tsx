import { useLingui } from '@lingui/react/macro'
import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionDetail } from '../types/requisition.types'

import { formatDateTime, formatPercent } from '@/shared/lib/formatters'

/** Sin autorizar todavía: guion largo, no celda vacía. */
const NOT_AUTHORIZED = '—'

/**
 * La cinta de datos duros bajo el encabezado: quién autorizó, cuándo, y el
 * tamaño de la requisición.
 *
 * Es una `<dl>` y no una tabla: son seis pares etiqueta-valor de un mismo
 * objeto, no filas comparables entre sí. Cada uno como tile con ícono —mismo
 * patrón que los datos del hero de "Revisión del día" en Timesheet— para que
 * seis números sueltos no se lean como una tabla de formulario.
 */
export function RequisitionSummaryStrip({ detail }: { detail: RequisitionDetail }): ReactNode {
  const { t } = useLingui()
  const { totals } = detail
  const { slotCount, occupiedCount } = totals

  const fields = [
    {
      label: t`Autorizada por`,
      value: detail.authorizedByName ?? NOT_AUTHORIZED,
      icon: 'how_to_reg',
    },
    {
      label: t`Autorizada el`,
      value: detail.authorizedAt ? formatDateTime(detail.authorizedAt) : NOT_AUTHORIZED,
      icon: 'event_available',
    },
    { label: t`Inspector de zona`, value: detail.inspectorName, icon: 'verified_user' },
    { label: t`Posiciones`, value: String(totals.positionCount), icon: 'work' },
    {
      label: t`Slots`,
      value: t`${slotCount} · ${occupiedCount} ocupados`,
      icon: 'groups',
    },
    { label: t`Cobertura`, value: formatPercent(totals.coverage), icon: 'donut_large' },
  ]

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {fields.map((field) => (
        <div
          key={field.label}
          className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface p-3"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-o-50">
            <MaterialIcon name={field.icon} className="text-lg text-o-700" aria-hidden />
          </span>
          <span className="min-w-0">
            <dt className="text-[11px] leading-tight text-ink-3">{field.label}</dt>
            <dd className="truncate text-base font-bold text-ink" title={field.value}>
              {field.value}
            </dd>
          </span>
        </div>
      ))}
    </dl>
  )
}
