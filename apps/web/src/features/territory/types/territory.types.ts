import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type { GeoPoint } from '@/shared/types/geo.types'

/**
 * Formas de respuesta del endpoint de Mi Territorio.
 *
 * ⚠ Igual que las de Onboarding, deberían vivir en `packages/contracts` (§5).
 * Están aquí porque ese paquete está fuera del alcance acordado.
 */

/**
 * Entrada del timeline reducido que se ve en la ficha del mapa. Solo trae el
 * estado y la fecha: la etiqueta la pone el front desde el semáforo, para que
 * el backend no mande texto de UI.
 */
export interface TerritoryTimelineEntry {
  id: string
  status: OnboardingStatus
  changedAt: string
}

export interface TerritoryHotel {
  /** Es el id del prospecto: «Abrir ficha» lleva a su detalle. */
  id: string
  hotelName: string
  zoneId: string
  /** Nombre completo para la lista: `Zona Centro`. */
  zone: string
  status: OnboardingStatus
  daysInStatus: number
  /** Solo en NARANJA. En el resto de estados es `null`. */
  clientSince: string | null
  location: GeoPoint
  geofenceMeters: number
  timeZone: string
  /** Los últimos tres cambios de estado, del más reciente al más viejo. */
  recentHistory: TerritoryTimelineEntry[]
}

export interface TerritoryZone {
  id: string
  /** Nombre corto para el chip: `Norte`. */
  label: string
  count: number
}

export interface Territory {
  /** Total del territorio, no los hoteles de esta página. */
  total: number
  zones: TerritoryZone[]
  hotels: TerritoryHotel[]
}

export interface TerritoryFilters {
  /** `null` = todas las zonas. */
  zoneId: string | null
  search: string
}
