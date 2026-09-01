import { cn, StatusLightBadge } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { TerritoryHotel } from '../types/territory.types'

import { HotelPhotoBackdrop } from '@/shared/components/HotelPhotoBackdrop'
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_TOKEN,
} from '@/shared/constants/onboardingStatus'
import { formatDayMonth, formatDaysInStatus } from '@/shared/lib/formatters'

/**
 * Tarjeta de la lista. Selecciona el hotel en el mapa en vez de navegar: el
 * salto al detalle se hace desde «Abrir ficha», ya con el hotel ubicado.
 */
export function TerritoryHotelCard({
  hotel,
  isSelected,
  onSelect,
}: {
  hotel: TerritoryHotel
  isSelected: boolean
  onSelect: (hotelId: string) => void
}): ReactNode {
  /** Un cliente activo ya no cuenta días en estado: lo que importa es desde cuándo lo es. */
  const meta = hotel.clientSince
    ? `Cliente desde ${formatDayMonth(hotel.clientSince)}`
    : formatDaysInStatus(hotel.daysInStatus)

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(hotel.id)
      }}
      aria-pressed={isSelected}
      className={cn(
        'relative isolate h-28 w-full shrink-0 cursor-pointer touch-manipulation overflow-hidden rounded-2xl text-left shadow-md transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-o-500',
        /* Seleccionada: un filo blanco fino, no un marco naranja que compite con el semáforo. */
        isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-surface',
      )}
    >
      <div className="absolute inset-0 -z-10">
        <HotelPhotoBackdrop photoUrl={hotel.photoUrl} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/35 to-ink/10"
      />

      <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/15 px-3 py-2 text-white backdrop-blur-[3px]">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold">{hotel.hotelName}</span>
          <StatusLightBadge
            token={ONBOARDING_STATUS_TOKEN[hotel.status]}
            label={ONBOARDING_STATUS_LABEL[hotel.status]}
            className="shrink-0"
          />
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-white/80">
          <span className="truncate">{hotel.zone}</span>
          <span className="shrink-0">{meta}</span>
        </div>
      </div>
    </button>
  )
}
