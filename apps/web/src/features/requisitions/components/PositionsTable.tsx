import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionPosition } from '../types/requisition.types'

import { CoverageBadge } from './CoverageBadge'

import { SectionCard } from '@/shared/components/SectionCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import { URGENCY_LABEL, URGENCY_TOKEN } from '@/shared/constants/requisitionStatus'
import { formatDayMonth } from '@/shared/lib/formatters'

/** `#` no es texto: se pinta tal cual; el resto se traduce al pintar con `i18n._()` (D-36). */
const HEADERS: readonly (MessageDescriptor | '#')[] = [
  '#',
  msg`Posición`,
  msg`Cant.`,
  msg`Inicio`,
  msg`Cobertura`,
  msg`Urgencia`,
  msg`Modalidad`,
]

export function PositionsTable({
  positions,
  selectedId,
  onSelect,
}: {
  positions: RequisitionPosition[]
  selectedId: string
  onSelect: (positionId: string) => void
}): ReactNode {
  const { t, i18n } = useLingui()

  return (
    <SectionCard
      title={t`Posiciones`}
      subtitle={t`Cada posición lleva dos semáforos: Cobertura (cuántos slots están ocupados) y Urgencia (cuánto falta para su inicio)`}
    >
      <Table className="min-w-[46rem] text-left">
        <TableHeader>
          <TableRow className="border-line">
            {HEADERS.map((header) => {
              const label = header === '#' ? header : i18n._(header)
              return (
                <TableHead
                  key={label}
                  scope="col"
                  className="px-3 py-3 text-xs font-semibold tracking-wide text-ink-3 uppercase"
                >
                  {label}
                </TableHead>
              )
            })}
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
