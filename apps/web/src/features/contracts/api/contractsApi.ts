import type { ContractDetail, ContractList, ContractListFilters } from '../types/contract.types'

import { registerContractsMocks } from './contractsMocks'

import { baseApi } from '@/app/baseApi'

registerContractsMocks()

/**
 * Documentos T&C sobre el `createApi` único (D-12), con el tag `Contract`.
 *
 * El filtrado va al servidor y no al front: la tabla es una página de una lista
 * que crecerá con cada hotel, y filtrar lo que ya se descargó daría resultados
 * incompletos en cuanto haya más de una página.
 */
export const contractsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getContracts: build.query<ContractList, ContractListFilters>({
      query: ({ search, status, zoneName }) => ({
        url: '/contracts',
        params: { search, status, zone: zoneName },
      }),
      providesTags: (list) => [
        { type: 'Contract' as const, id: 'LIST' },
        ...(list?.items ?? []).map((item) => ({ type: 'Contract' as const, id: item.id })),
      ],
    }),

    getContract: build.query<ContractDetail, string>({
      query: (contractId) => `/contracts/${contractId}`,
      providesTags: (_detail, _error, contractId) => [
        { type: 'Contract' as const, id: contractId },
      ],
    }),
  }),
})

export const { useGetContractsQuery, useGetContractQuery } = contractsApi
