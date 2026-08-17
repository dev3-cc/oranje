import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ProspectSummary } from '../types/prospect.types'
import { resolveActivityLabel } from '../utils/resolveActivityLabel'

import { formatDaysInStatus } from '@/shared/lib/formatters'

/** Tarjeta del tablero. Entra al detalle: la tarjeta completa es el enlace. */
export function ProspectCard({ prospect }: { prospect: ProspectSummary }): ReactNode {
  return (
    <Link
      to={`/pipeline/${prospect.id}`}
      className="block rounded-md border border-line bg-surface p-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
    >
      <p className="text-base font-semibold text-ink">{prospect.hotelName}</p>

      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm text-ink-3">
        <span>{prospect.zone}</span>
        <span>{formatDaysInStatus(prospect.daysInStatus)}</span>
      </div>

      <p className="mt-1.5 text-sm text-ink-3">{resolveActivityLabel(prospect)}</p>

      <div className="mt-3 flex items-center gap-2">
        <span className="size-5 shrink-0 rounded-full bg-o-50" aria-hidden />
        <span className="text-sm text-ink-3">{prospect.owner.shortName}</span>
      </div>
    </Link>
  )
}
