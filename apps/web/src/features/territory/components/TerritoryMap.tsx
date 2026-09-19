import { statusLight } from '@oranje/ui'
import { useMemo, type ReactNode } from 'react'

import type { TerritoryHotel } from '../types/territory.types'

import { HotelMapCard } from './HotelMapCard'
import { TerritoryMapLegend } from './TerritoryMapLegend'

import { HotelPointsMap, type HotelMapPoint } from '@/shared/components/HotelPointsMap'
import { ONBOARDING_STATUS_TOKEN } from '@/shared/constants/onboardingStatus'

export interface TerritoryMapProps {
  hotels: TerritoryHotel[]
  selectedHotel: TerritoryHotel | null
  onSelect: (hotelId: string) => void
  /** Cerrar la ficha (en móvil es la única forma de recuperar el mapa). */
  onClose: () => void
  className?: string
}

/**
 * El mapa de Mi Territorio: el color del marcador es el semáforo de Onboarding.
 *
 * El mapa en sí vive en `shared`; aquí solo se decide qué significa cada color
 * y qué se pinta encima.
 */
export function TerritoryMap({
  hotels,
  selectedHotel,
  onSelect,
  onClose,
  className,
}: TerritoryMapProps): ReactNode {
  const points = useMemo<HotelMapPoint[]>(
    () =>
      hotels.map((hotel) => ({
        id: hotel.id,
        title: hotel.hotelName,
        location: hotel.location,
        color: statusLight[ONBOARDING_STATUS_TOKEN[hotel.status]],
      })),
    [hotels],
  )

  return (
    <HotelPointsMap
      points={points}
      selectedId={selectedHotel?.id ?? null}
      onSelect={onSelect}
      className={className}
    >
      {selectedHotel && <HotelMapCard hotel={selectedHotel} onClose={onClose} />}
      <TerritoryMapLegend isBehindCard={selectedHotel !== null} />
    </HotelPointsMap>
  )
}
