import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { ProspectSummary } from '../types/prospect.types'
import { resolveActivityLabel } from '../utils/resolveActivityLabel'

import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import { StarBorder } from '@/shared/components/StarBorder'
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
    <StarBorder>
      <Link
        to={`/pipeline/${prospect.id}`}
        className="relative block h-48 overflow-hidden rounded-2xl shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500"
      >
        <HotelPhotoBackdrop photoUrl={prospect.photoUrl} />
        {/* El velo oscuro de abajo hacia arriba es lo que hace legible el vidrio con texto blanco. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/10"
        />
        <span className="absolute top-2 right-2 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
          {formatDaysInStatus(prospect.daysInStatus)}
        </span>

        {/* El panel de vidrio oscuro (el mismo del hero de Inicio y de Perfil). */}
        <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/15 p-3 text-white backdrop-blur-sm">
          <p className="truncate text-base font-semibold">{prospect.hotelName}</p>
          <p className="mt-0.5 truncate text-sm text-white/80">
            {prospect.zone} · {resolveActivityLabel(prospect)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="size-5 shrink-0 rounded-full border border-white/40 bg-white/20"
              aria-hidden
            />
            <span className="text-sm font-medium text-white/85">{prospect.owner.shortName}</span>
          </div>
        </div>
      </Link>
    </StarBorder>
  )
}
