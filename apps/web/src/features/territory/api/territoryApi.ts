import type { Territory, TerritoryFilters } from '../types/territory.types'

import { registerTerritoryMocks } from './territoryMocks'

import { baseApi } from '@/app/baseApi'

/**
 * Endpoint de Mi Territorio sobre el `createApi` único (D-12).
 *
 * URL y método definitivos; hoy lo atiende la capa de fixtures. Comparte el tag
 * `Prospect` con Onboarding a propósito: cambiar el estado de un prospecto
 * también cambia el color de su punto en el mapa, así que esa mutación tiene
 * que invalidar esta consulta.
 */
registerTerritoryMocks()

export const territoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTerritory: build.query<Territory, TerritoryFilters>({
      query: (filters) => ({
        url: '/territory',
        params: {
          ...(filters.zoneId ? { zoneId: filters.zoneId } : {}),
          ...(filters.search ? { q: filters.search } : {}),
        },
      }),
      providesTags: (territory) => [
        { type: 'Prospect' as const, id: 'LIST' },
        ...(territory?.hotels ?? []).map((hotel) => ({ type: 'Prospect' as const, id: hotel.id })),
      ],
    }),
  }),
})

export const { useGetTerritoryQuery } = territoryApi
