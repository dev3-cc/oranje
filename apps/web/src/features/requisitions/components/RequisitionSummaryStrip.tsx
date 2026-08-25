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
 * objeto, no filas comparables entre sí.
 */
export function RequisitionSummaryStrip({ detail }: { detail: RequisitionDetail }): ReactNode {
  const { totals } = detail

  const fields = [
    { label: 'Autorizada por', value: detail.authorizedByName ?? NOT_AUTHORIZED },
    {
      label: 'Autorizada el',
      value: detail.authorizedAt ? formatDateTime(detail.authorizedAt) : NOT_AUTHORIZED,
    },
    { label: 'Inspector de zona', value: detail.inspectorName },
    { label: 'Posiciones', value: String(totals.positionCount) },
    {
      label: 'Slots',
      value: `${String(totals.slotCount)} · ${String(totals.occupiedCount)} ocupados`,
    },
    { label: 'Cobertura', value: formatPercent(totals.coverage) },
  ]

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg border border-line bg-surface px-6 py-5 sm:grid-cols-3 xl:grid-cols-6">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-sm text-ink-3">{field.label}</dt>
          <dd className="mt-1 truncate text-base font-semibold text-ink" title={field.value}>
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
