import type { ClientCard, ClientFilters, ClientPortfolio } from '../types/client.types'
import { ANY_VALUE } from '../types/client.types'

import { registerClientsMocks } from './clientsMocks'

import { baseApi } from '@/app/baseApi'
import type { ContractStatus } from '@/shared/constants/contractStatus'
import { normalizeText as normalize } from '@/shared/lib/text'
import type {
  ApiEnvelope,
  ContractApi,
  HotelApi,
  PaginatedEnvelope,
  ProspectApi,
} from '@/shared/types/apiContract.types'

/**
 * La cartera no tiene endpoint propio: se COMPONE del contrato real — los
 * hoteles activados (`/hotels` con `activated_at`), su prospecto (la ficha del
 * Pipeline ES la del cliente) y su contrato con tarifas (`/contracts` +
 * detalle). El mismo patrón de Mi Territorio y el Dashboard.
 */
registerClientsMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** Con varios contratos gana el vigente; luego el borrador; al final el resto. */
const CONTRACT_PRIORITY: Record<string, number> = { ACTIVE: 0, DRAFT: 1, EXPIRED: 2, CANCELLED: 3 }

function pickContract(contracts: ContractApi[]): ContractApi | undefined {
  return [...contracts].sort(
    (a, b) =>
      (CONTRACT_PRIORITY[a.status] ?? 9) - (CONTRACT_PRIORITY[b.status] ?? 9) ||
      b.validFrom.localeCompare(a.validFrom),
  )[0]
}

async function fetchPortfolio(
  fetchWithBQ: FetchWithBQ,
  filters: ClientFilters,
): Promise<{ data: ClientPortfolio } | { error: unknown }> {
  const [hotelsRes, prospectsRes, contractsRes] = await Promise.all([
    fetchWithBQ({ url: '/hotels', params: { limit: 100 } }),
    fetchWithBQ({ url: '/prospects', params: { limit: 100, includeClosed: true } }),
    fetchWithBQ('/contracts'),
  ])
  if (hotelsRes.error) return { error: hotelsRes.error }
  if (prospectsRes.error) return { error: prospectsRes.error }
  if (contractsRes.error) return { error: contractsRes.error }

  const clients = (hotelsRes.data as PaginatedEnvelope<HotelApi>).data.filter(
    (hotel) => hotel.isClient && hotel.activatedAt !== null,
  )
  const prospectByHotel = new Map(
    (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data.map((prospect) => [
      prospect.hotel.id,
      prospect,
    ]),
  )
  const contractsByHotel = new Map<string, ContractApi[]>()
  for (const contract of (contractsRes.data as ApiEnvelope<ContractApi[]>).data) {
    const list = contractsByHotel.get(contract.hotel.id) ?? []
    list.push(contract)
    contractsByHotel.set(contract.hotel.id, list)
  }

  /** Posiciones y rango de tarifas viven en las tarifas: solo el detalle las trae. */
  const chosen = new Map(
    clients
      .map((hotel) => pickContract(contractsByHotel.get(hotel.id) ?? []))
      .filter((contract): contract is ContractApi => contract !== undefined)
      .map((contract) => [contract.id, contract]),
  )
  const detailById = new Map<string, ContractApi>()
  await Promise.all(
    [...chosen.keys()].map(async (contractId) => {
      const res = await fetchWithBQ(`/contracts/${contractId}`)
      if (!res.error) {
        const detail = (res.data as ApiEnvelope<ContractApi>).data
        detailById.set(detail.id, detail)
      }
    }),
  )

  const allCards: ClientCard[] = clients
    .filter((hotel) => hotel.latitude !== null && hotel.longitude !== null)
    .map((hotel) => {
      const contract = pickContract(contractsByHotel.get(hotel.id) ?? [])
      const detail = contract ? detailById.get(contract.id) : undefined
      const billRates = (detail?.rates ?? []).map((rate) => Number(rate.billRate))
      return {
        id: hotel.id,
        /** Sin ciclo en el sistema (activado por fuera), la ficha es el hotel. */
        prospectId: prospectByHotel.get(hotel.id)?.id ?? hotel.id,
        hotelName: hotel.name,
        photoUrl: hotel.photoUrl,
        zoneName: hotel.zone.name.replace(/^Zona\s+/i, ''),
        activatedAt: hotel.activatedAt as string,
        timezone: hotel.timeZone,
        geofenceRadiusM: hotel.geofenceRadiusM ?? 150,
        location: { lat: hotel.latitude as number, lng: hotel.longitude as number },
        contract: contract
          ? {
              id: contract.id,
              number: contract.number,
              status: contract.status as ContractStatus,
              positionCount: detail?.rates?.length ?? 0,
              minRate: billRates.length ? Math.min(...billRates) : 0,
              maxRate: billRates.length ? Math.max(...billRates) : 0,
            }
          : null,
      }
    })

  const items = allCards
    .filter((card) => {
      if (filters.zoneName !== ANY_VALUE && card.zoneName !== filters.zoneName) return false
      if (
        filters.contractStatus !== ANY_VALUE &&
        card.contract?.status !== filters.contractStatus
      ) {
        return false
      }
      if (
        filters.activationYear !== ANY_VALUE &&
        !card.activatedAt.startsWith(filters.activationYear)
      ) {
        return false
      }
      if (filters.search && !normalize(card.hotelName).includes(normalize(filters.search))) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      if (filters.sort === 'NAME') return a.hotelName.localeCompare(b.hotelName)
      if (filters.sort === 'OLDEST') return a.activatedAt.localeCompare(b.activatedAt)
      return b.activatedAt.localeCompare(a.activatedAt)
    })

  return {
    data: {
      items,
      total: allCards.length,
      zoneNames: [...new Set(allCards.map((card) => card.zoneName))].sort(),
      activationYears: [...new Set(allCards.map((card) => Number(card.activatedAt.slice(0, 4))))]
        .sort()
        .reverse(),
    },
  }
}

export const clientsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClients: build.query<ClientPortfolio, ClientFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchPortfolio(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      /** Convertir un prospecto o renovar un contrato refresca la cartera. */
      providesTags: (portfolio) => [
        { type: 'Hotel' as const, id: 'LIST' },
        { type: 'Contract' as const, id: 'LIST' },
        { type: 'Prospect' as const, id: 'LIST' },
        ...(portfolio?.items ?? []).map((item) => ({ type: 'Hotel' as const, id: item.id })),
      ],
    }),
  }),
})

export const { useGetClientsQuery } = clientsApi
