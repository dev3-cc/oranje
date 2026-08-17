import { cn, SemaforoBadge } from '@oranje/ui'
import type { ReactNode } from 'react'

import type { TerritoryHotel } from '../types/territory.types'

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
        'w-full rounded-md p-4 text-left transition-colors',
        isSelected
          ? 'border-2 border-o-500 bg-o-50'
          : 'border border-line bg-surface hover:bg-surface-2',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-semibold text-ink">{hotel.hotelName}</span>
        <SemaforoBadge
          token={ONBOARDING_STATUS_TOKEN[hotel.status]}
          label={ONBOARDING_STATUS_LABEL[hotel.status]}
          className="shrink-0"
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm text-ink-3">
        <span>{hotel.zone}</span>
        <span>{meta}</span>
      </div>
    </button>
  )
}
