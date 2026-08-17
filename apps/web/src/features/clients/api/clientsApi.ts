import type { ClientFilters, ClientPortfolio } from '../types/client.types'

import { registerClientsMocks } from './clientsMocks'

import { baseApi } from '@/app/baseApi'

registerClientsMocks()

/**
 * Clientes Activos sobre el `createApi` único (D-12).
 *
 * Provee el tag `Hotel` y NO `Contract`, aunque la tarjeta muestre el folio: lo
 * que lista este endpoint son hoteles. Consume además `Contract/LIST`, así que
 * renovar un contrato en Documentos T&C refresca también esta cartera.
 */
export const clientsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClients: build.query<ClientPortfolio, ClientFilters>({
      query: ({ search, zoneName, contractStatus, activationYear, sort }) => ({
        url: '/clients',
        params: { search, zone: zoneName, contractStatus, year: activationYear, sort },
      }),
      providesTags: (portfolio) => [
        { type: 'Hotel' as const, id: 'LIST' },
        { type: 'Contract' as const, id: 'LIST' },
        ...(portfolio?.items ?? []).map((item) => ({ type: 'Hotel' as const, id: item.id })),
      ],
    }),
  }),
})

export const { useGetClientsQuery } = clientsApi
