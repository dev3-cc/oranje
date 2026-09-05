import type {
  Territory,
  TerritoryFilters,
  TerritoryHotel,
  TerritoryOwner,
} from '../types/territory.types'

import { registerTerritoryMocks } from './territoryMocks'

import { baseApi } from '@/app/baseApi'
import '@/app/sessionApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import { normalizeText as normalize } from '@/shared/lib/text'
import type {
  ApiEnvelope,
  HotelApi,
  PaginatedEnvelope,
  ProspectApi,
  TeamMemberApi,
} from '@/shared/types/apiContract.types'

registerTerritoryMocks()

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
    photoUrl: hotel.photoUrl,
    zoneId: hotel.zone.id,
    zone: hotel.zone.name,
    location: { lat: hotel.latitude, lng: hotel.longitude },
    geofenceMeters: hotel.geofenceRadiusM ?? 150,
    timeZone: hotel.timeZone,
    recentHistory: [],
  }

  if (prospect) {
    return {
      ...base,
      id: prospect.id,
      status: prospect.state.code as OnboardingStatus,
      daysInStatus: daysSince(prospect.stateSince),
      clientSince: hotel.isClient ? hotel.activatedAt : null,
    }
  }

  if (hotel.isClient) {
    return {
      ...base,
      id: hotel.id,
      status: 'ORANGE',
      daysInStatus: hotel.activatedAt ? daysSince(hotel.activatedAt) : 0,
      clientSince: hotel.activatedAt,
    }
  }

  return null
}

async function fetchTerritory(
  fetchWithBQ: FetchWithBQ,
  filters: TerritoryFilters,
): Promise<{ data: Territory } | { error: unknown }> {
  let ownerId = filters.userId ?? null
  let hasOwnTerritory = true

  if (!ownerId) {
    const meRes = await fetchWithBQ('/me')
    if (meRes.error) return { error: meRes.error }
    const me = (meRes.data as ApiEnvelope<{ id: string; role: { code: string } }>).data
    ownerId = me.id
    hasOwnTerritory = me.role.code === 'ROL-V-01'
  }

  const [zonesRes, hotelsRes, prospectsRes] = await Promise.all([
    hasOwnTerritory ? fetchWithBQ(`/users/${ownerId}/zones`) : Promise.resolve({ data: null }),
    fetchWithBQ({ url: '/hotels', params: { limit: 100 } }),
    fetchWithBQ({ url: '/prospects', params: { limit: 100 } }),
  ])
  if ('error' in zonesRes && zonesRes.error) return { error: zonesRes.error }
  if (hotelsRes.error) return { error: hotelsRes.error }
  if (prospectsRes.error) return { error: prospectsRes.error }

  const myZoneIds = hasOwnTerritory
    ? new Set((zonesRes.data as ZonesEnvelope).data.zones.map((zone) => zone.id))
    : new Set<string>()
  const inScope = (hotel: HotelApi): boolean => myZoneIds.size === 0 || myZoneIds.has(hotel.zone.id)

  const prospectByHotel = new Map(
    (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data
      .filter((prospect) => !filters.userId || prospect.owner.id === filters.userId)
      .map((prospect) => [prospect.hotel.id, prospect]),
  )

  const allHotels = (hotelsRes.data as PaginatedEnvelope<HotelApi>).data
    .filter(inScope)
    .map((hotel) => toTerritoryHotel(hotel, prospectByHotel.get(hotel.id)))
    .filter((hotel): hotel is TerritoryHotel => hotel !== null)

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
      providesTags: [
        { type: 'Prospect', id: 'LIST' },
        { type: 'Hotel', id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetTerritoryQuery, useGetTerritoryOwnersQuery } = territoryApi
