import type {
  ContractDetail,
  ContractList,
  ContractListFilters,
  ContractRow,
} from '../types/contract.types'
import { ANY_VALUE } from '../types/contract.types'

import { registerContractsMocks } from './contractsMocks'

import { baseApi } from '@/app/baseApi'
import type { ContractStatus } from '@/shared/constants/contractStatus'
import type {
  ApiEnvelope,
  ContractApi,
  HotelApi,
  PaginatedEnvelope,
} from '@/shared/types/apiContract.types'

/**
 * Documentos T&C sobre el contrato real: `GET /contracts` da la lista y
 * `GET /contracts/:id` las tarifas. La zona no viaja en el contrato (solo
 * `hotel.id`/`name`): se resuelve con una pasada por `/hotels`. `elapsed` y
 * `daysRemaining` se calculan aquí al momento de la consulta — el backend
 * aún no los agrega.
 */
registerContractsMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000

function progressOf(contract: ContractApi): {
  elapsed: number | null
  daysRemaining: number | null
} {
  if (contract.status === 'DRAFT' || !contract.validTo) {
    return { elapsed: null, daysRemaining: null }
  }
  const from = new Date(contract.validFrom).getTime()
  const to = new Date(contract.validTo).getTime()
  const now = Date.now()
  const elapsed = to <= from ? null : Math.min(1, Math.max(0, (now - from) / (to - from)))
  return { elapsed, daysRemaining: Math.ceil((to - now) / MS_PER_DAY) }
}

function toRow(contract: ContractApi, zoneName: string, positionCount: number): ContractRow {
  return {
    id: contract.id,
    number: contract.number,
    hotelName: contract.hotel.name,
    zoneName,
    status: contract.status as ContractStatus,
    validFrom: contract.status === 'DRAFT' ? null : contract.validFrom,
    validTo: contract.validTo,
    ...progressOf(contract),
    positionCount,
    overtimeBillMultiplier:
      contract.status === 'DRAFT' ? null : Number(contract.multipliers.overtimeBill),
    holidayBillMultiplier:
      contract.status === 'DRAFT' ? null : Number(contract.multipliers.holidayBill),
  }
}

export function toContractDetail(contract: ContractApi): ContractDetail {
  return {
    id: contract.id,
    number: contract.number,
    hotelName: contract.hotel.name,
    status: contract.status as ContractStatus,
    /** El contrato real aún no guarda QUIÉN firmó, solo cuándo. */
    signedByName: '—',
    signedAt: contract.signedAt ?? contract.createdAt,
    validFrom: contract.validFrom,
    validTo: contract.validTo,
    weekStartDay: contract.week.startDay,
    weekEndDay: contract.week.endDay,
    multipliers: {
      overtime: {
        pay: Number(contract.multipliers.overtimePay),
        bill: Number(contract.multipliers.overtimeBill),
      },
      holiday: {
        pay: Number(contract.multipliers.holidayPay),
        bill: Number(contract.multipliers.holidayBill),
      },
    },
    rates: (contract.rates ?? []).map((rate) => ({
      id: rate.id,
      positionName: rate.position.name,
      payRate: Number(rate.payRate),
      billRate: Number(rate.billRate),
    })),
  }
}

/** Minúsculas y sin acentos, para que «bahia» encuentre «Bahía». */
function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function fetchContractList(
  fetchWithBQ: FetchWithBQ,
  filters: ContractListFilters,
): Promise<{ data: ContractList } | { error: unknown }> {
  const [contractsRes, hotelsRes] = await Promise.all([
    fetchWithBQ('/contracts'),
    fetchWithBQ({ url: '/hotels', params: { limit: 100 } }),
  ])
  if (contractsRes.error) return { error: contractsRes.error }
  if (hotelsRes.error) return { error: hotelsRes.error }

  const contracts = (contractsRes.data as ApiEnvelope<ContractApi[]>).data
  const hotels = (hotelsRes.data as PaginatedEnvelope<HotelApi>).data
  const zoneByHotel = new Map(hotels.map((hotel) => [hotel.id, hotel.zone.name]))

  /** El conteo de posiciones vive en las tarifas: solo las trae el detalle. */
  const details = await Promise.all(
    contracts.map((contract) => fetchWithBQ(`/contracts/${contract.id}`)),
  )
  const countById = new Map(
    details
      .filter((res) => !res.error)
      .map((res) => {
        const detail = (res.data as ApiEnvelope<ContractApi>).data
        return [detail.id, detail.rates?.length ?? 0] as const
      }),
  )

  const rows = contracts.map((contract) =>
    toRow(
      contract,
      zoneByHotel.get(contract.hotel.id)?.replace(/^Zona\s+/i, '') ?? '',
      countById.get(contract.id) ?? 0,
    ),
  )

  const items = rows.filter((row) => {
    if (filters.status !== ANY_VALUE && row.status !== filters.status) return false
    if (filters.zoneName !== ANY_VALUE && row.zoneName !== filters.zoneName) return false
    if (
      filters.search &&
      !normalize(`${row.number} ${row.hotelName}`).includes(normalize(filters.search))
    ) {
      return false
    }
    return true
  })

  return {
    data: {
      items,
      zoneNames: [...new Set(rows.map((row) => row.zoneName).filter(Boolean))].sort(),
    },
  }
}

export const contractsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getContracts: build.query<ContractList, ContractListFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchContractList(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (list) => [
        { type: 'Contract' as const, id: 'LIST' },
        ...(list?.items ?? []).map((item) => ({ type: 'Contract' as const, id: item.id })),
      ],
    }),

    getContract: build.query<ContractDetail, string>({
      query: (contractId) => `/contracts/${contractId}`,
      transformResponse: (raw: ApiEnvelope<ContractApi>) => toContractDetail(raw.data),
      providesTags: (_detail, _error, contractId) => [
        { type: 'Contract' as const, id: contractId },
      ],
    }),

    /** Lo que el alta necesita elegir: el hotel cliente y las posiciones del catálogo. */
    getContractFormOptions: build.query<ContractFormOptions, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const [hotelsRes, positionsRes] = await Promise.all([
          bq({ url: '/hotels', params: { limit: 100 } }),
          bq('/catalogs/positions'),
        ])
        if (hotelsRes.error) return { error: hotelsRes.error as never }
        if (positionsRes.error) return { error: positionsRes.error as never }
        return {
          data: {
            hotels: (hotelsRes.data as PaginatedEnvelope<HotelApi>).data
              .filter((hotel) => hotel.isClient)
              .map((hotel) => ({ id: hotel.id, name: hotel.name })),
            positions: (
              positionsRes.data as ApiEnvelope<Array<{ id: string; name: string }>>
            ).data.map((item) => ({ id: item.id, name: item.name })),
          },
        }
      },
      providesTags: [{ type: 'Catalog' as const, id: 'CONTRACT_FORM' }],
    }),

    /** El contrato nace en DRAFT con al menos una tarifa (guard del back). */
    createContract: build.mutation<ContractDetail, CreateContractRequest>({
      query: (body) => ({ url: '/contracts', method: 'POST', body }),
      transformResponse: (raw: ApiEnvelope<ContractApi>) => toContractDetail(raw.data),
      invalidatesTags: [{ type: 'Contract' as const, id: 'LIST' }],
    }),

    /** Alta o corrección de una tarifa; el back solo lo permite en DRAFT. */
    upsertContractRate: build.mutation<
      ContractDetail,
      { contractId: string; catalogPositionId: string; payRate: string; billRate: string }
    >({
      query: ({ contractId, ...body }) => ({
        url: `/contracts/${contractId}/rates`,
        method: 'PUT',
        body,
      }),
      transformResponse: (raw: ApiEnvelope<ContractApi>) => toContractDetail(raw.data),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: 'Contract' as const, id: contractId },
        { type: 'Contract' as const, id: 'LIST' },
      ],
    }),

    /**
     * activate / expire / cancel: los tres son hechos, no ediciones — el
     * status del contrato nunca se escribe directo (mismo criterio que los
     * semáforos, D-23). Invalidan también `Hotel`: la cartera de Clientes
     * Activos compone su chip de contrato de aquí.
     */
    transitionContract: build.mutation<
      ContractDetail,
      { contractId: string; action: 'activate' | 'expire' | 'cancel' }
    >({
      query: ({ contractId, action }) => ({
        url: `/contracts/${contractId}/${action}`,
        method: 'POST',
      }),
      transformResponse: (raw: ApiEnvelope<ContractApi>) => toContractDetail(raw.data),
      invalidatesTags: (_result, _error, { contractId }) => [
        { type: 'Contract' as const, id: contractId },
        { type: 'Contract' as const, id: 'LIST' },
        { type: 'Hotel' as const, id: 'LIST' },
      ],
    }),
  }),
})

export interface ContractFormOptions {
  hotels: Array<{ id: string; name: string }>
  positions: Array<{ id: string; name: string }>
}

/** El cuerpo de `POST /contracts`, transcrito del DTO real (`contract.dto.ts`). */
export interface CreateContractRequest {
  hotelId: string
  prospectId?: string
  validFrom: string
  validTo?: string
  weekStartDay: number
  weekEndDay: number
  overtimeBillMultiplier: number
  overtimePayMultiplier: number
  holidayBillMultiplier: number
  holidayPayMultiplier: number
  deductsMeals: boolean
  splitsInvoiceByMonth: boolean
  rates: Array<{ catalogPositionId: string; payRate: string; billRate: string }>
}

export const {
  useGetContractsQuery,
  useGetContractQuery,
  useGetContractFormOptionsQuery,
  useCreateContractMutation,
  useUpsertContractRateMutation,
  useTransitionContractMutation,
} = contractsApi
