import { SemaforoBadge, statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { TerritoryHotel } from '../types/territory.types'

import { buttonClass } from '@/shared/components/Button'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDate } from '@/shared/lib/formatters'

/**
 * Ficha del hotel seleccionado, flotando sobre el mapa.
 *
 * No es un `InfoWindow` de Google anclado al marcador: el diseño la coloca fija
 * en la esquina del mapa, sin pico ni la cromática por defecto de la librería.
 * Como panel propio se controla el estilo por completo y no se mueve al
 * desplazar el mapa.
 *
 * El texto de cada entrada del timeline sale del semáforo, no del backend: la
 * API manda estado y fecha, la UI pone las palabras.
 */
export function HotelMapCard({ hotel }: { hotel: TerritoryHotel }): ReactNode {
  return (
    <article className="absolute top-6 left-6 z-10 w-[26rem] max-w-[calc(100%-3rem)] rounded-lg bg-surface p-6 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{hotel.hotelName}</h2>
        <SemaforoBadge
          token={ONBOARDING_STATUS_TOKEN[hotel.status]}
          label={ONBOARDING_STATUS_LABEL[hotel.status]}
          className="shrink-0"
        />
      </div>

      <p className="mt-2 text-sm text-ink-3">
        {hotel.zone} · geocerca {hotel.geofenceMeters} m · {hotel.timeZone}
      </p>

      <hr className="my-4 border-line" />

      <h3 className="text-sm font-semibold text-ink">Timeline del semáforo</h3>

      <ol className="mt-3 flex flex-col gap-3">
        {hotel.recentHistory.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: statusLight[ONBOARDING_STATUS_TOKEN[entry.status]] }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {ONBOARDING_STATUS_DESCRIPTION[entry.status]}
              </p>
              <p className="text-sm text-ink-3">{formatDate(entry.changedAt)}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link to={`/pipeline/${hotel.id}`} className={buttonClass('primary', 'mt-5 w-full')}>
        Abrir ficha
      </Link>
    </article>
  )
}
