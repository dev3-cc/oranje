import { MaterialIcon } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ProspectSummary } from '../types/prospect.types'
import { resolveActivityLabel } from '../utils/resolveActivityLabel'

import { formatDaysInStatus } from '@/shared/lib/formatters'

/**
 * Tarjeta del tablero, con la foto de Places como portada cuando existe. La
 * tarjeta completa es el enlace al detalle.
 *
 * Los hoteles dados de alta antes de la columna `photo_url` no tienen foto:
 * su portada es un bloque neutro con el icono de hotel, a la misma altura,
 * para que las columnas del kanban no bailen entre tarjetas.
 */
export function ProspectCard({ prospect }: { prospect: ProspectSummary }): ReactNode {
  return (
    <Link
      to={`/pipeline/${prospect.id}`}
      className="block overflow-hidden rounded-md border border-line bg-surface transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
    >
      <div className="relative h-24">
        {prospect.photoUrl ? (
          <img src={prospect.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface-2">
            <MaterialIcon name="apartment" className="text-3xl text-ink-4" aria-hidden />
          </div>
        )}
        {/* El fundido disuelve la foto hacia la tarjeta: el nombre se lee sobre el remate. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent via-surface/70 to-surface"
        />
        <span className="absolute top-2 right-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-semibold text-ink-2 shadow-sm">
          {formatDaysInStatus(prospect.daysInStatus)}
        </span>
      </div>

      <div className="p-4 pt-1">
        <p className="text-base font-semibold text-ink">{prospect.hotelName}</p>
        <p className="mt-0.5 text-sm text-ink-3">{prospect.zone}</p>

        <p className="mt-1.5 text-sm text-ink-3">{resolveActivityLabel(prospect)}</p>

        <div className="mt-3 flex items-center gap-2">
          <span className="size-5 shrink-0 rounded-full bg-o-50" aria-hidden />
          <span className="text-sm text-ink-3">{prospect.owner.shortName}</span>
        </div>
      </div>
    </Link>
  )
}
