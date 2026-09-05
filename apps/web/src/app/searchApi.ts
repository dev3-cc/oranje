/*
 * ⚠ Imports entre features, permitidos SOLO aquí: la búsqueda global compone
 * tres listas cuyos fixtures viven en sus features. Con mocks apagados los
 * registros son no-op.
 */

import { baseApi } from '@/app/baseApi'
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
// eslint-disable-next-line no-restricted-imports
import { registerPoolMocks } from '@/features/recruitment/api/poolMocks'
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import type {
  PaginatedEnvelope,
  ProspectApi,
  RequisitionApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

registerOnboardingMocks()
registerPoolMocks()
registerRequisitionsMocks()

/** Un resultado de la búsqueda global: a dónde lleva y cómo se lee. */
export interface SearchHit {
  id: string
  /** Qué es: decide el icono y el grupo. */
  kind: 'prospect' | 'requisition' | 'worker'
  title: string
  subtitle: string
  to: string
}

export interface GlobalSearchResult {
  prospects: SearchHit[]
  requisitions: SearchHit[]
  workers: SearchHit[]
}

type FetchWithBQ = (
  arg: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** `Hotel Xcaret` y `xcaret` deben encontrarse: sin acentos ni mayúsculas. */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const MAX_PER_GROUP = 5

/**
 * La búsqueda global del header (Ctrl K), compuesta del contrato real
 * (D-28): prospectos por hotel (`/prospects`), requisiciones por folio u
 * hotel (`/requisitions`) y colaboradores por nombre (`/workers?search=`,
 * que el back sí resuelve). Cada grupo es tolerante al 403: quien no ve
 * requisiciones no ve ese grupo, y nada más.
 */
export const searchApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    globalSearch: build.query<GlobalSearchResult, string>({
      queryFn: async (term, _api, _extra, rawBaseQuery) => {
        const fetchWithBQ = rawBaseQuery as FetchWithBQ
        const needle = normalizeForSearch(term)
        if (needle === '') return { data: { prospects: [], requisitions: [], workers: [] } }

        const [prospectsRes, requisitionsRes, workersRes] = await Promise.all([
          fetchWithBQ({ url: '/prospects', params: { limit: 100 } }),
          fetchWithBQ({ url: '/requisitions', params: { limit: 100 } }),
          fetchWithBQ({ url: '/workers', params: { limit: MAX_PER_GROUP, search: term.trim() } }),
        ])

        const prospects = prospectsRes.error
          ? []
          : (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data
              .filter((prospect) => normalizeForSearch(prospect.hotel.name).includes(needle))
              .slice(0, MAX_PER_GROUP)
              .map((prospect): SearchHit => ({
                id: prospect.id,
                kind: 'prospect',
                title: prospect.hotel.name,
                subtitle: `Prospecto · ${prospect.state.name}`,
                to: `/pipeline/${prospect.id}`,
              }))

        const requisitions = requisitionsRes.error
          ? []
          : (requisitionsRes.data as PaginatedEnvelope<RequisitionApi>).data
              .filter(
                (requisition) =>
                  normalizeForSearch(requisition.number).includes(needle) ||
                  normalizeForSearch(requisition.hotel.name).includes(needle),
              )
              .slice(0, MAX_PER_GROUP)
              .map((requisition): SearchHit => ({
                id: requisition.id,
                kind: 'requisition',
                title: requisition.number,
                subtitle: `${requisition.hotel.name} · ${requisition.state.name}`,
                to: `/requisiciones/${requisition.id}`,
              }))

        const workers = workersRes.error
          ? []
          : (workersRes.data as PaginatedEnvelope<WorkerApi>).data
              .slice(0, MAX_PER_GROUP)
              .map((worker): SearchHit => ({
                id: worker.id,
                kind: 'worker',
                title: worker.fullName,
                subtitle: `Colaborador · ${worker.position?.name ?? 'Sin posición'} · ${worker.state.name}`,
                to: `/pool-colaboradores/${worker.id}`,
              }))

        return { data: { prospects, requisitions, workers } }
      },
    }),
  }),
})

export const { useGlobalSearchQuery } = searchApi
