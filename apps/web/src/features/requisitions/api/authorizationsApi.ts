import type {
  AuthorizationQueue,
  AuthorizationRequest,
  ResolveAuthorizationPayload,
  StatusChangeReason,
} from '../types/requisition.types'

import { registerAuthorizationsMocks } from './authorizationsMocks'

import { baseApi } from '@/app/baseApi'
import type { UrgencyLevel } from '@/shared/constants/requisitionStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import type {
  ApiEnvelope,
  PaginatedEnvelope,
  RequisitionApi,
} from '@/shared/types/apiContract.types'

registerAuthorizationsMocks()

type FetchWithBQ = (
  args: string | { url: string; method?: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / MS_PER_DAY)
}

/** RR-H-05: < 72 h Rojo, 72–120 h Amarillo, > 120 h Verde fuerte. */
function urgencyFor(days: number): UrgencyLevel {
  const hours = days * 24
  if (hours < 72) return 'RED'
  if (hours <= 120) return 'YELLOW'
  return 'STRONG_GREEN'
}

function toRequest(requisition: RequisitionApi): AuthorizationRequest {
  const earliestStart = requisition.positions
    .map((position) => position.startDate)
    .sort((a, b) => a.localeCompare(b))[0]
  const startsInDays = earliestStart ? daysUntil(earliestStart) : 0

  return {
    id: requisition.id,
    number: requisition.number,
    hotelName: requisition.hotel.name,
    department: [
      ...new Set(requisition.positions.map((position) => position.department.name)),
    ].join(', '),
    requestedByName: '—',
    status: 'APPLE_GREEN',
    positionCount: requisition.positions.length,
    slotCount: requisition.totalSlots,
    startsInDays,
    positions: requisition.positions.map((position) => ({
      id: position.id,
      index: position.lineNumber,
      name: position.position.name,
      quantity: position.quantity,
      startDate: position.startDate,
      startTime: position.startTime ?? '—',
      english: position.englishLevel?.name ?? '—',
      coverage: { filled: position.filled, total: position.quantity },
      urgency: urgencyFor(daysUntil(position.startDate)),
      modality: position.hiringModality.name,
      slots: [],
    })),
    urgencyPreview: {
      startDate: earliestStart ?? '',
      daysAhead: startsInDays,
      urgency: urgencyFor(startsInDays),
      positionCount: requisition.positions.length,
    },
  }
}

async function fetchQueue(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: AuthorizationQueue } | { error: unknown }> {
  const [listRes, meRes] = await Promise.all([
    fetchWithBQ({ url: '/requisitions', params: { state: 'APPLE_GREEN', limit: 100 } }),
    fetchWithBQ('/me'),
  ])
  if (listRes.error) return { error: listRes.error }
  if (meRes.error) return { error: meRes.error }

  const requisitions = (listRes.data as PaginatedEnvelope<RequisitionApi>).data
  const me = (meRes.data as ApiEnvelope<{ role: { code: string; name: string } }>).data

  const scope =
    me.role.code === 'ROL-H-03'
      ? 'todos los departamentos de tu hotel'
      : `solo tu departamento${IS_DEV_UI ? ' (D-09)' : ''}`

  return {
    data: {
      items: requisitions.map(toRequest).sort((a, b) => a.startsInDays - b.startsInDays),
      authorizerRole: me.role.name,
      authorizerScope: scope,
    },
  }
}

export const authorizationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAuthorizationQueue: build.query<AuthorizationQueue, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchQueue(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (queue) => [
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
        ...(queue?.items ?? []).map((item) => ({ type: 'Requisition' as const, id: item.id })),
      ],
    }),

    getRequisitionReturnReasons: build.query<{ items: StatusChangeReason[] }, void>({
      query: () => ({ url: '/catalogs/reasons', params: { statusLight: 'REQUISITION' } }),
      transformResponse: (raw: ApiEnvelope<Array<{ code: string; name: string }>>) => ({
        items: raw.data.map((reason) => ({ id: reason.code, label: reason.name })),
      }),
      providesTags: [{ type: 'Catalog' as const, id: 'REQUISITION_RETURN_REASONS' }],
    }),

    authorizeRequisition: build.mutation<unknown, ResolveAuthorizationPayload>({
      query: ({ requisitionId }) => ({
        url: `/requisitions/${requisitionId}/authorize`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { requisitionId }) => [
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),
  }),
})

export const {
  useGetAuthorizationQueueQuery,
  useGetRequisitionReturnReasonsQuery,
  useAuthorizeRequisitionMutation,
} = authorizationsApi
