import type {
  Territory,
  TerritoryFilters,
  TerritoryHotel,
  TerritoryOwner,
} from '../types/territory.types'

import { registerTerritoryMocks } from './territoryMocks'

import { baseApi } from '@/app/baseApi'
/** Efecto secundario: registra el mock de `/me`, que esta composición consume. */
import '@/app/sessionApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type {
  ApiEnvelope,
  HotelApi,
  PaginatedEnvelope,
  ProspectApi,
  TeamMemberApi,
} from '@/shared/types/apiContract.types'

/**
 * El contrato real no tiene un `GET /territory`: la pantalla se COMPONE de
 * cuatro recursos que sí existen — la sesión, las zonas asignadas (el módulo
 * de territorio del back), los hoteles (coordenada y foto) y los prospectos
 * (el estado del semáforo). El mismo patrón del detalle del prospecto.
 */
registerTerritoryMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

interface ZonesEnvelope {
  data: { zones: Array<{ id: string; name: string }> }
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/** Minúsculas y sin acentos, para que «bahia» encuentre «Bahía». */
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** «Zona Centro» ya dice zona en el chip: el label queda en «Centro». */
function zoneLabel(name: string): string {
  return name.replace(/^Zona\s+/i, '')
}

function toTerritoryHotel(
  hotel: HotelApi,
  prospect: ProspectApi | undefined,
): TerritoryHotel | null {
  if (hotel.latitude === null || hotel.longitude === null) return null

  const base = {
    hotelName: hotel.name,
    zoneId: hotel.zone.id,
    zone: hotel.zone.name,
    location: { lat: hotel.latitude, lng: hotel.longitude },
    geofenceMeters: hotel.geofenceRadiusM ?? 150,
    timeZone: hotel.timeZone,
    /** El contrato no da la historia sin N+1 llamadas: la ficha la enseña vacía. */
    recentHistory: [],
  }

  if (prospect) {
    return {
      ...base,
      id: prospect.id,
      status: prospect.state.code as OnboardingStatus,
      daysInStatus: daysSince(prospect.stateSince),
      /** Un NARANJA con ciclo abierto ya es cliente: la fecha viene del hotel. */
      clientSince: hotel.isClient ? hotel.activatedAt : null,
    }
  }

  if (hotel.isClient) {
    return {
      ...base,
      /** Sin ciclo abierto: la ficha apunta al hotel, no a un prospecto. */
      id: hotel.id,
      status: 'ORANGE',
      daysInStatus: hotel.activatedAt ? daysSince(hotel.activatedAt) : 0,
      clientSince: hotel.activatedAt,
    }
  }

  // Ni ciclo abierto ni cliente: no hay nada que trabajar en el territorio.
  return null
}

async function fetchTerritory(
  fetchWithBQ: FetchWithBQ,
  filters: TerritoryFilters,
): Promise<{ data: Territory } | { error: unknown }> {
  /** `filters.userId` es el BD que el BDC eligió; sin él, el territorio propio. */
  let ownerId = filters.userId ?? null

  if (!ownerId) {
    const meRes = await fetchWithBQ('/me')
    if (meRes.error) return { error: meRes.error }
    ownerId = (meRes.data as ApiEnvelope<{ id: string }>).data.id
  }

  const [zonesRes, hotelsRes, prospectsRes] = await Promise.all([
    fetchWithBQ(`/users/${ownerId}/zones`),
    fetchWithBQ({ url: '/hotels', params: { limit: 100 } }),
    fetchWithBQ({ url: '/prospects', params: { limit: 100 } }),
  ])
  if (zonesRes.error) return { error: zonesRes.error }
  if (hotelsRes.error) return { error: hotelsRes.error }
  if (prospectsRes.error) return { error: prospectsRes.error }

  /**
   * Las zonas asignadas acotan el territorio. Sin asignación todavía
   * (`user_zone` vacío) se muestra todo: una pantalla vacía diría «no tienes
   * territorio» cuando lo cierto es que nadie lo ha repartido aún.
   */
  const myZoneIds = new Set((zonesRes.data as ZonesEnvelope).data.zones.map((zone) => zone.id))
  const inScope = (hotel: HotelApi): boolean => myZoneIds.size === 0 || myZoneIds.has(hotel.zone.id)

  /**
   * `GET /prospects` ya viene acotado por el alcance de quien pregunta: el BD
   * ve los suyos y el BDC todos. Al mirar el territorio de otro hay que filtrar
   * por dueño, o el BDC vería sus prospectos sobre el mapa del BD.
   */
  const prospectByHotel = new Map(
    (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data
      .filter((prospect) => !filters.userId || prospect.owner.id === filters.userId)
      .map((prospect) => [prospect.hotel.id, prospect]),
  )

  const allHotels = (hotelsRes.data as PaginatedEnvelope<HotelApi>).data
    .filter(inScope)
    .map((hotel) => toTerritoryHotel(hotel, prospectByHotel.get(hotel.id)))
    .filter((hotel): hotel is TerritoryHotel => hotel !== null)

  /** Chips por zona ANTES de filtrar: el conteo no cambia al buscar. */
  const zoneCount = new Map<string, { id: string; label: string; count: number }>()
  for (const hotel of allHotels) {
    const entry = zoneCount.get(hotel.zoneId)
    if (entry) {
      entry.count += 1
    } else {
      zoneCount.set(hotel.zoneId, { id: hotel.zoneId, label: zoneLabel(hotel.zone), count: 1 })
    }
  }

  const hotels = allHotels.filter((hotel) => {
    if (filters.zoneId && hotel.zoneId !== filters.zoneId) return false
    if (filters.search && !normalize(hotel.hotelName).includes(normalize(filters.search))) {
      return false
    }
    return true
  })

  return {
    data: {
      total: allHotels.length,
      zones: [...zoneCount.values()].sort((a, b) => a.label.localeCompare(b.label)),
      hotels,
    },
  }
}

export const territoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * A quién puede mirarle el territorio quien pregunta. El BD no tiene
     * equipo: recibe 403 y la lista queda vacía, que es lo correcto — su
     * pantalla no lleva selector.
     */
    getTerritoryOwners: build.query<TerritoryOwner[], void>({
      query: () => '/team',
      transformResponse: (response: ApiEnvelope<TeamMemberApi[]>) =>
        response.data.map((member) => ({
          id: member.id,
          fullName: member.fullName,
          zoneCount: member.zones.length,
          openProspects: member.openProspects,
        })),
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    getTerritory: build.query<Territory, TerritoryFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchTerritory(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      /**
       * Comparte el tag `Prospect` con Onboarding a propósito: cambiar el
       * estado de un prospecto también cambia el color de su punto en el mapa.
       */
      providesTags: [
        { type: 'Prospect', id: 'LIST' },
        { type: 'Hotel', id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetTerritoryQuery, useGetTerritoryOwnersQuery } = territoryApi
