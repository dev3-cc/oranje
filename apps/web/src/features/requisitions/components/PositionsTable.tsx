import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionPosition } from '../types/requisition.types'

import { CoverageBadge } from './CoverageBadge'

import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { URGENCY_LABEL, URGENCY_TOKEN } from '@/shared/constants/requisitionStatus'
import { formatDayMonth } from '@/shared/lib/formatters'

const HEADERS = ['#', 'Posición', 'Cant.', 'Inicio', 'Cobertura', 'Urgencia', 'Modalidad']

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
      <Table className="min-w-[46rem] text-left">
        <TableHeader>
          <TableRow className="border-line">
            {HEADERS.map((header) => (
              <TableHead
                key={header}
                scope="col"
                className="px-3 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {positions.map((position) => {
            const isSelected = position.id === selectedId

            return (
              <TableRow
                key={position.id}
                aria-current={isSelected ? 'true' : undefined}
                className={cn('border-line hover:bg-surface-2', isSelected && 'bg-surface-2')}
              >
                <TableCell className="px-3 py-4 text-sm text-ink-3">{position.index}</TableCell>

                <TableCell className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(position.id)
                    }}
                    className="rounded-sm text-sm font-medium whitespace-nowrap text-ink hover:text-o-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                  >
                    {position.name}
                  </button>
                </TableCell>

                <TableCell className="px-3 py-4 text-sm text-ink-2">{position.quantity}</TableCell>

                <TableCell className="px-3 py-4 text-sm text-ink-2">
                  {formatDayMonth(position.startDate)}
                </TableCell>

                <TableCell className="px-3 py-4">
                  <CoverageBadge coverage={position.coverage} />
                </TableCell>

                <TableCell className="px-3 py-4">
                  <StatusLightSoftBadge
                    token={URGENCY_TOKEN[position.urgency]}
                    label={URGENCY_LABEL[position.urgency]}
                  />
                </TableCell>

                <TableCell className="px-3 py-4 text-sm text-ink-2">{position.modality}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
