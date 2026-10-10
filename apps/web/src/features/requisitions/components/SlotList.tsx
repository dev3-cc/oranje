import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cn } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

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

function SlotRow({
  slot,
  assignHref,
}: {
  slot: RequisitionSlot
  /** A dónde lleva un slot libre; `null` = esta fila no se puede llenar desde aquí. */
  assignHref: string | null
}): ReactNode {
  const { t, i18n } = useLingui()
  const isOccupied = slot.status === 'occupied'

  const destino =
    isOccupied && slot.assigneeId !== null && slot.assigneeName !== null
      ? {
          href: `/collaborator-pool/${slot.assigneeId}`,
          nombre: t`Ver el perfil de ${slot.assigneeName}`,
        }
      : assignHref !== null
        ? { href: assignHref, nombre: t`Asignar al siguiente slot libre` }
        : null

  return (
    <li
      className={cn(
        'relative flex items-center gap-4 rounded-lg border px-4 py-3.5',
        isOccupied ? 'border-line bg-surface' : 'border-transparent bg-surface-2',
        destino !== null && 'transition-colors hover:bg-surface-3',
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

      {/* Toda la fila es un enlace (Hugo, 2026-10-09): libre lleva a llenarla,
          ocupada al perfil de quien la ocupa. Es un enlace estirado y no un
          `onClick` en el `li` para que se abra en otra pestaña, se alcance con
          el tabulador y el lector de pantalla lo anuncie como lo que es.
          El del slot libre dice «el siguiente libre» y no el número de ESTA
          fila: la pantalla de destino siempre llena el siguiente slot libre de
          la posición, así que prometer el 2 y llenar el 1 sería mentir.
          Para el perfil, el API decide si puede verlo: Reclutamiento siempre,
          el hotel solo a quien tiene asignado — y este slot es suyo. */}
      {destino !== null && (
        <Link
          to={destino.href}
          className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
        >
          <span className="sr-only">{destino.nombre}</span>
        </Link>
      )}

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

export function SlotList({
  position,
  requisitionId,
  canAssign,
  assignHint,
}: {
  position: RequisitionPosition
  requisitionId: string
  /**
   * Si desde esta ficha se puede llenar un slot. Lo decide la pantalla: pide
   * `requisitions:take` Y que la requisición esté abierta, que son las dos
   * condiciones reales de la pantalla de asignación. Sin eso no se dibuja el
   * enlace — un renglón que al tocarlo rebota es peor que uno quieto.
   */
  canAssign: boolean
  /**
   * Por qué no se puede llenar desde aquí, cuando no se puede. Sin esto el
   * renglón simplemente no responde y no hay forma de saber si falta un
   * permiso, falta la firma o es un defecto (Hugo, 2026-10-09).
   */
  assignHint?: string
}): ReactNode {
  const { t } = useLingui()
  const { index, name } = position
  const assignHref = canAssign ? `/self-pick/${requisitionId}/${position.id}` : null

  return (
    <SectionCard
      title={t`Slots de la posición ${index} · ${name}`}
      subtitle={
        IS_DEV_UI
          ? 'La unidad de bloqueo. Un slot libre se puede borrar; uno ocupado no (FK de coverage.assignment)'
          : t`Cada slot es un lugar por cubrir. Un slot libre se puede borrar; uno ocupado no.`
      }
    >
      {!canAssign &&
        assignHint !== undefined &&
        position.slots.some((s) => s.status === 'free') && (
          <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">{assignHint}</p>
        )}

      <ul className="flex flex-col gap-3">
        {position.slots.map((slot) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            assignHref={slot.status === 'free' ? assignHref : null}
          />
        ))}
      </ul>
    </SectionCard>
  )
}
