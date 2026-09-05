import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { RequisitionRow } from '../types/requisition.types'

import { CoverageBar } from './CoverageBar'

import { EmptyState } from '@/shared/components/EmptyState'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { MagicCard } from '@/shared/components/MagicCard'
import { StatusLightSoftBadge } from '@/shared/components/StatusLightSoftBadge'
import {
  REQUISITION_STATUS_LABEL,
  REQUISITION_STATUS_TOKEN,
  URGENCY_LABEL,
  URGENCY_TOKEN,
} from '@/shared/constants/requisitionStatus'
import { formatDayMonthTime } from '@/shared/lib/formatters'

function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

/**
 * El tablero como tarjetas (patrón de las del Pipeline): la foto del hotel
 * de portada con fundido hacia la tarjeta, el folio y su urgencia encima,
 * quién la pidió con su avatar, y la cobertura como barra. La foto y el
 * creador son opcionales — se encienden cuando el back los exponga; sin
 * foto queda el edificio, como en el Pipeline.
 */
function RequisitionCard({ item }: { item: RequisitionRow }): ReactNode {
  /* Magic Bento (reactbits): la tarjeta avisa al pasar; se apaga sola en táctil y reduced motion. */
  return (
    <MagicCard className="rounded-2xl">
      <Link
        to={`/requisiciones/${item.id}`}
        className="block touch-manipulation overflow-hidden rounded-2xl bg-surface shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
      >
        <div className="relative h-24">
          <HotelPhotoBackdrop photoUrl={item.hotelPhotoUrl} />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent via-surface/70 to-surface"
          />
          <span className="absolute top-2 right-2">
            <StatusLightSoftBadge
              token={URGENCY_TOKEN[item.urgency]}
              label={URGENCY_LABEL[item.urgency]}
            />
          </span>
        </div>

        <div className="p-4 pt-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-base font-semibold text-ink">{item.hotelName}</p>
            <StatusLightSoftBadge
              token={REQUISITION_STATUS_TOKEN[item.status]}
              label={REQUISITION_STATUS_LABEL[item.status]}
            />
          </div>
          <p className="mt-0.5 text-sm text-ink-3">
            {item.number} · {item.department} · {item.positions}{' '}
            {item.positions === 1 ? 'posición' : 'posiciones'}
          </p>

          <div className="mt-3">
            <CoverageBar coverage={item.coverage} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            {item.creator ? (
              <span className="flex min-w-0 items-center gap-2">
                {item.creator.photoUrl ? (
                  <img
                    src={item.creator.photoUrl}
                    alt=""
                    aria-hidden
                    className="size-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-o-500/15 text-[11px] font-bold text-o-700"
                  >
                    {initialsOf(item.creator.name)}
                  </span>
                )}
                <span className="truncate text-sm text-ink-2">{item.creator.name}</span>
              </span>
            ) : (
              <span className="text-sm text-ink-4">—</span>
            )}
            <span className="shrink-0 text-xs text-ink-3">
              {item.authorizedAt
                ? `Autorizada ${formatDayMonthTime(item.authorizedAt)}`
                : 'Borrador'}
            </span>
          </div>
        </div>
      </Link>
    </MagicCard>
  )
}

export function RequisitionCardList({ items }: { items: RequisitionRow[] }): ReactNode {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aún no hay requisiciones"
        text="Cuando un hotel pida personal, su requisición aparecerá aquí con su semáforo. Los borradores solo los ve quien los crea."
      />
    )
  }
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,22rem))]">
      {items.map((item) => (
        <RequisitionCard key={item.id} item={item} />
      ))}
    </div>
  )
}
