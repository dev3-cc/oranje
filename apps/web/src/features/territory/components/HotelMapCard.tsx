import { MaterialIcon, StatusLightBadge, statusLight } from '@oranje/ui'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { TerritoryHotel } from '../types/territory.types'

import { buttonClass } from '@/shared/components/Button'
import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDate } from '@/shared/lib/formatters'

/**
 * Ficha del hotel seleccionado sobre el mapa.
 *
 * En escritorio flota en la esquina, como el diseño; en móvil se vuelve una
 * HOJA INFERIOR compacta — una tarjeta centrada taparía justo el mapa que se
 * quería ver. El timeline solo se pinta si trae entradas (una cabecera vacía
 * no informa nada) y en móvil se recorta a las dos más recientes.
 */
export function HotelMapCard({
  hotel,
  onClose,
}: {
  hotel: TerritoryHotel
  onClose: () => void
}): ReactNode {
  return (
    <article className="absolute inset-x-3 bottom-3 z-10 isolate overflow-hidden rounded-2xl p-4 text-white shadow-lg sm:inset-x-auto sm:top-6 sm:bottom-auto sm:left-6 sm:w-[26rem] sm:max-w-[calc(100%-3rem)] sm:p-6">
      {/* La foto del hotel de fondo con el velo oscuro: el mismo vidrio del hero de Inicio. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <HotelPhotoBackdrop photoUrl={hotel.photoUrl} />
        <div className="absolute inset-0 bg-ink/70" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-white drop-shadow-sm">{hotel.hotelName}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <StatusLightBadge
            token={ONBOARDING_STATUS_TOKEN[hotel.status]}
            label={ONBOARDING_STATUS_LABEL[hotel.status]}
          />
          <button
            type="button"
            aria-label="Cerrar la ficha del hotel"
            onClick={onClose}
            className="flex size-8 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-sm text-white/80">
        {hotel.zone} · geocerca {hotel.geofenceMeters} m · {hotel.timeZone}
      </p>

      {hotel.recentHistory.length > 0 && (
        <>
          <div className="mt-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm sm:mt-4">
            <h3 className="text-sm font-semibold text-white">Timeline del semáforo</h3>

            <ol className="mt-2 flex flex-col gap-2 sm:mt-3 sm:gap-3">
              {hotel.recentHistory.map((entry, index) => (
                <li
                  key={entry.id}
                  /* En móvil solo las dos más recientes: la hoja no debe crecer. */
                  className={index >= 2 ? 'hidden gap-3 sm:flex' : 'flex gap-3'}
                >
                  <span
                    className="mt-1.5 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: statusLight[ONBOARDING_STATUS_TOKEN[entry.status]] }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {ONBOARDING_STATUS_DESCRIPTION[entry.status]}
                    </p>
                    <p className="text-sm text-white/70">{formatDate(entry.changedAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      <Link to={`/pipeline/${hotel.id}`} className={buttonClass('primary', 'mt-4 w-full sm:mt-5')}>
        Abrir ficha del hotel
      </Link>
    </article>
  )
}
