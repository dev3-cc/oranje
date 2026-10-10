import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useLingui } from '@lingui/react/macro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { RequisitionPosition } from '../types/requisition.types'

import { CoverageBadge } from './CoverageBadge'
import { UrgencyChip } from './UrgencyChip'

import ilustracionPosiciones from '@/assets/ilustrations/personaje-talento.svg'
import { NoticeCard } from '@/shared/components/NoticeCard'
import { SectionCard } from '@/shared/components/SectionCard'
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
  authorizedAt,
  selectedId,
  onSelect,
  requisitionId,
  canAssign,
}: {
  positions: RequisitionPosition[]
  authorizedAt: string | null
  selectedId: string
  onSelect: (positionId: string) => void
  requisitionId: string
  /** Misma condición que en los slots: `requisitions:take` y requisición abierta. */
  canAssign: boolean
}): ReactNode {
  const { t, i18n } = useLingui()

  return (
    <SectionCard
      title={t`Posiciones`}
      subtitle={t`Lo que el hotel pidió en esta requisición, renglón por renglón`}
    >
      {/* Qué es una posición, con ilustración (Hugo, 2026-10-09): la tabla
          sola no lo explica, y «posición», «slot» y «cobertura» son palabras
          de la casa que alguien nuevo no tiene por qué conocer. */}
      <NoticeCard image={ilustracionPosiciones} title={t`Qué estás viendo`}>
        <Trans>
          Cada renglón es un puesto que el hotel pidió: cuántas personas, desde cuándo y con qué
          modalidad. Cada persona pedida es un <strong>slot</strong>, y los slots se llenan en
          orden. <strong>Cobertura</strong> dice cuántos ya tienen a alguien;{' '}
          <strong>Urgencia</strong>, cuánto falta para que empiece.
        </Trans>
      </NoticeCard>

      <Table className="mt-4 min-w-[46rem] text-left">
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

                {/* Una posición a medio cubrir lleva a llenarla desde aquí
                    (Hugo, 2026-10-09), sin tener que seleccionarla primero y
                    bajar a los slots. Cubierta no es enlace: no hay nada que
                    llenar, y ahí quien manda es el nombre de cada slot. */}
                <TableCell className="px-3 py-4">
                  {canAssign && position.coverage.filled < position.coverage.total ? (
                    <Link
                      to={`/self-pick/${requisitionId}/${position.id}`}
                      title={t`Asignar al siguiente slot libre`}
                      className="inline-block rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
                    >
                      <CoverageBadge coverage={position.coverage} />
                    </Link>
                  ) : (
                    <CoverageBadge coverage={position.coverage} />
                  )}
                </TableCell>

                <TableCell className="px-3 py-4">
                  <UrgencyChip
                    urgency={position.urgency}
                    startDate={position.startDate}
                    authorizedAt={authorizedAt}
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
