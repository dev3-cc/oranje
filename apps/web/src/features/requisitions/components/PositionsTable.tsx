import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionPosition } from '../types/requisition.types'

import { CoverageBadge } from './CoverageBadge'

import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { URGENCY_LABEL, URGENCY_TOKEN } from '@/shared/constants/requisitionStatus'
import { formatDayMonth } from '@/shared/lib/formatters'

const HEADERS = ['#', 'Posición', 'Cant.', 'Inicio', 'Cobertura', 'Urgencia', 'Modalidad']

/**
 * Las posiciones de la requisición. Al elegir una se cambia el detalle de slots
 * de abajo.
 *
 * El nombre de la posición es un `<button>` y no un `onClick` en el `<tr>`: una
 * fila entera clicable no es alcanzable por teclado ni se anuncia como algo que
 * se pueda activar.
 */
export function PositionsTable({
  positions,
  selectedId,
  onSelect,
}: {
  positions: RequisitionPosition[]
  selectedId: string
  onSelect: (positionId: string) => void
}): ReactNode {
  return (
    <SectionCard
      title="Posiciones"
      subtitle="Cada posición carga dos semáforos: Cobertura (contada sobre slots) y Urgencia (derivada de su fecha de inicio)"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-3 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {positions.map((position) => {
              const isSelected = position.id === selectedId

              return (
                <tr
                  key={position.id}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'border-b border-line last:border-b-0',
                    isSelected ? 'bg-surface-2' : 'hover:bg-surface-2',
                  )}
                >
                  <td className="px-3 py-4 text-sm text-ink-3">{position.index}</td>

                  <td className="px-3 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(position.id)
                      }}
                      className="rounded-sm text-sm font-medium whitespace-nowrap text-ink hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                    >
                      {position.name}
                    </button>
                  </td>

                  <td className="px-3 py-4 text-sm text-ink-2">{position.quantity}</td>

                  <td className="px-3 py-4 text-sm whitespace-nowrap text-ink-2">
                    {formatDayMonth(position.startDate)}
                  </td>

                  <td className="px-3 py-4">
                    <CoverageBadge coverage={position.coverage} />
                  </td>

                  <td className="px-3 py-4">
                    <StatusLightSoftBadge
                      token={URGENCY_TOKEN[position.urgency]}
                      label={URGENCY_LABEL[position.urgency]}
                    />
                  </td>

                  <td className="px-3 py-4 text-sm whitespace-nowrap text-ink-2">
                    {position.modality}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
