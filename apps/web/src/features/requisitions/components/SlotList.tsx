import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { RequisitionPosition, RequisitionSlot } from '../types/requisition.types'

import { SectionCard } from '@/shared/components/SectionCard'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonthTime } from '@/shared/lib/formatters'

/**
 * Los slots de una posición, uno por renglón.
 *
 * En dev el estado se escribe con el valor del enum —`occupied`, `free`— como
 * en la maqueta (documentación viva del contrato); en build, la persona lee
 * «Ocupado» y «Libre», traducidos al pintar con `i18n._()` (D-36).
 */
const SLOT_STATUS_LABEL: Record<RequisitionSlot['status'], MessageDescriptor> = {
  occupied: msg`Ocupado`,
  free: msg`Libre`,
}

function SlotRow({ slot }: { slot: RequisitionSlot }): ReactNode {
  const { t, i18n } = useLingui()
  const isOccupied = slot.status === 'occupied'

  return (
    <li
      className={cn(
        'flex items-center gap-4 rounded-lg border px-4 py-3.5',
        isOccupied ? 'border-line bg-surface' : 'border-transparent bg-surface-2',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
          isOccupied ? 'bg-green/15 text-ink' : 'bg-surface-3 text-ink-2',
        )}
        aria-hidden
      >
        {slot.index}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', isOccupied ? 'text-ink' : 'text-ink-3')}>
          {slot.assigneeName ?? t`Sin asignar`}
        </p>
        <p className="mt-0.5 truncate text-sm text-ink-3">
          {/*
            «Asignado» concuerda con el slot, no con quien lo ocupa: la maqueta
            dice «Asignada» porque las tres personas del ejemplo son mujeres, y
            deducir el género del nombre acaba mal.
          */}
          {slot.assignedAt
            ? t`Asignado ${formatDayMonthTime(slot.assignedAt)}`
            : slot.offerChannel && i18n._(slot.offerChannel)}
        </p>
      </div>

      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
          isOccupied ? 'bg-green/15 text-ink-2' : 'bg-surface-3 text-ink-3',
        )}
      >
        <span
          className={cn('size-2 shrink-0 rounded-full', isOccupied ? 'bg-green' : 'bg-ink-3')}
          aria-hidden
        />
        {IS_DEV_UI ? slot.status : i18n._(SLOT_STATUS_LABEL[slot.status])}
      </span>
    </li>
  )
}

export function SlotList({ position }: { position: RequisitionPosition }): ReactNode {
  const { t } = useLingui()
  const { index, name } = position

  return (
    <SectionCard
      title={t`Slots de la posición ${index} · ${name}`}
      subtitle={
        IS_DEV_UI
          ? 'La unidad de bloqueo. Un slot libre se puede borrar; uno ocupado no (FK de coverage.assignment)'
          : t`Cada slot es un lugar por cubrir. Un slot libre se puede borrar; uno ocupado no.`
      }
    >
      <ul className="flex flex-col gap-3">
        {position.slots.map((slot) => (
          <SlotRow key={slot.id} slot={slot} />
        ))}
      </ul>
    </SectionCard>
  )
}
