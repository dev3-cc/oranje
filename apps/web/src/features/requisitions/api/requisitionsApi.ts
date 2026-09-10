import { msg } from '@lingui/core/macro'

import type {
  CreateRequisitionRequest,
  RequisitionBoard,
  RequisitionDetail,
  RequisitionFormOptions,
  RequisitionHotelOption,
  RequisitionParticipant,
  RequisitionPosition,
  RequisitionRow,
  RequisitionSlot,
} from '../types/requisition.types'

import { registerRequisitionsMocks } from './requisitionsMocks'

import { baseApi } from '@/app/baseApi'
import type { RequisitionStatus, UrgencyLevel } from '@/shared/constants/requisitionStatus'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type {
  ApiEnvelope,
  AssignmentApi,
  CatalogItemApi,
  HotelApi,
  PaginatedEnvelope,
  ParticipantApi,
  ParticipationResultApi,
  RequisitionApi,
  RequisitionPositionApi,
} from '@/shared/types/apiContract.types'

registerRequisitionsMocks()

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const URGENCY_RANK: Record<string, number> = { RED: 0, YELLOW: 1, STRONG_GREEN: 2 }

function worstUrgency(requisition: RequisitionApi): UrgencyLevel {
  const codes = requisition.positions
    .map((position) => position.urgency?.code)
    .filter((code): code is string => code !== undefined && code !== null)
  if (codes.length === 0) return 'STRONG_GREEN'
  return codes.sort((a, b) => (URGENCY_RANK[a] ?? 9) - (URGENCY_RANK[b] ?? 9))[0] as UrgencyLevel
}

function rowDepartment(requisition: RequisitionApi): string {
  const names = [...new Set(requisition.positions.map((position) => position.department.name))]
  if (names.length === 0) return '—'
  if (names.length === 1) return names[0] as string
  return `${names[0] as string} +${String(names.length - 1)}`
}

function toRow(requisition: RequisitionApi): RequisitionRow {
  return {
    id: requisition.id,
    number: requisition.number,
    hotelName: requisition.hotel.name,
    department: rowDepartment(requisition),
    positions: requisition.totalSlots,
    coverage: { filled: requisition.filledSlots, total: requisition.totalSlots },
    urgency: worstUrgency(requisition),
    status: requisition.state.code as RequisitionStatus,
    authorizedAt: requisition.authorizedAt,
    inspectorName: '—',
    hotelPhotoUrl: requisition.hotel.photoUrl ?? null,
    creator: requisition.createdBy
      ? { name: requisition.createdBy.fullName, photoUrl: requisition.createdBy.photoUrl }
      : null,
  }
}

/**
 * Los slots ocupados se llenan con las asignaciones ACTIVAS reales. El
 * contrato no dice a qué POSICIÓN pertenece cada asignación (solo el ordinal
 * del slot), así que se casan por ordinal y, si no hay, en orden — exacto con
 * una posición; aproximado con varias (encargo al back si llega a doler).
 */
function buildSlots(position: RequisitionPositionApi, pool: AssignmentApi[]): RequisitionSlot[] {
  return Array.from({ length: position.quantity }, (_item, index) => {
    const isOccupied = index < position.filled
    let assignment: AssignmentApi | null = null
    if (isOccupied) {
      const byOrdinal = pool.findIndex((item) => item.slot.ordinal === index + 1)
      const poolIndex = byOrdinal >= 0 ? byOrdinal : 0
      assignment = pool[poolIndex] ?? null
      if (assignment) pool.splice(poolIndex, 1)
    }
    return {
      id: `${position.id}-slot-${String(index + 1)}`,
      index: index + 1,
      status: isOccupied ? 'occupied' : 'free',
      assigneeName: assignment?.worker.fullName ?? null,
      assignedAt: assignment?.createdAt ?? null,
      offerChannel: isOccupied ? null : msg`Visible en la Bolsa · Self-Pick`,
    }
  })
}

function toPosition(position: RequisitionPositionApi, pool: AssignmentApi[]): RequisitionPosition {
  return {
    id: position.id,
    index: position.lineNumber,
    name: position.position.name,
    quantity: position.quantity,
    startDate: position.startDate,
    startTime: position.startTime ?? '—',
    english: position.englishLevel?.name ?? '—',
    coverage: { filled: position.filled, total: position.quantity },
    urgency: (position.urgency?.code ?? 'STRONG_GREEN') as UrgencyLevel,
    modality: position.hiringModality.name,
    slots: buildSlots(position, pool),
  }
}

function toDetail(requisition: RequisitionApi, assignments: AssignmentApi[]): RequisitionDetail {
  const pool = assignments.filter((item) => item.status === 'ACTIVE')
  const positions = requisition.positions.map((position) => toPosition(position, pool))

  const history = [
    ...(requisition.authorizedAt
      ? [
          {
            id: `${requisition.id}-authorized`,
            fromStatus: 'APPLE_GREEN' as RequisitionStatus,
            toStatus: 'GREEN' as RequisitionStatus,
            action: msg`Autorizada`,
            byName: '—',
            at: requisition.authorizedAt,
          },
        ]
      : []),
    {
      id: `${requisition.id}-created`,
      fromStatus: null,
      toStatus: 'APPLE_GREEN' as RequisitionStatus,
      action: msg`Creada`,
      /* Quien la creó ES el autor de este evento; el dato ya venía (D-30). */
      byName: requisition.createdBy?.fullName ?? '—',
      at: requisition.createdAt,
    },
  ]

  return {
    id: requisition.id,
    number: requisition.number,
    hotelName: requisition.hotel.name,
    department: rowDepartment(requisition),
    status: requisition.state.code as RequisitionStatus,
    createdByName: requisition.createdBy?.fullName ?? '—',
    createdAt: requisition.createdAt,
    authorizedByName: requisition.authorizedAt ? '—' : null,
    authorizedAt: requisition.authorizedAt,
    inspectorName: '—',
    hotelPhotoUrl: requisition.hotel.photoUrl ?? null,
    totals: {
      positionCount: positions.length,
      slotCount: requisition.totalSlots,
      occupiedCount: requisition.filledSlots,
      coverage: requisition.totalSlots === 0 ? 0 : requisition.filledSlots / requisition.totalSlots,
    },
    positions,
    history,
  }
}

function toParticipant(row: ParticipantApi): RequisitionParticipant {
  return {
    id: row.id,
    userId: row.user.id,
    fullName: row.user.fullName,
    roleName: row.user.role.name,
    joinedAt: row.joinedAt,
  }
}

async function fetchBoard(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: RequisitionBoard } | { error: unknown }> {
  const listRes = await fetchAllPages<RequisitionApi>(fetchWithBQ, '/requisitions')
  if ('error' in listRes) return { error: listRes.error }
  const requisitions = listRes.data

  const rows = requisitions.map(toRow)
  const open = rows.filter((row) => row.status !== 'PURPLE' && row.status !== 'LIGHT_BLUE')
  const awaiting = requisitions.filter((requisition) => requisition.state.code === 'APPLE_GREEN')
  const over48h = awaiting.filter(
    (requisition) => Date.now() - new Date(requisition.createdAt).getTime() > 48 * 3_600_000,
  )

  return {
    data: {
      metrics: {
        openCount: open.length,
        openHotels: new Set(open.map((row) => row.hotelName)).size,
        awaitingAuthorization: awaiting.length,
        awaitingOver48h: over48h.length,
        partialCoverage: open.filter(
          (row) => row.coverage.filled > 0 && row.coverage.filled < row.coverage.total,
        ).length,
        freeSlots: open.reduce(
          (total, row) => total + (row.coverage.total - row.coverage.filled),
          0,
        ),
        urgentCount: open.filter((row) => row.urgency === 'RED').length,
        urgentRuleId: 'RR-H-05',
      },
      items: rows,
    },
  }
}

async function fetchFormOptions(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: RequisitionFormOptions } | { error: unknown }> {
  const [hotelsRes, departmentsRes, positionsRes, modalitiesRes, englishRes] = await Promise.all([
    fetchWithBQ({ url: '/hotels', params: { limit: 100 } }),
    fetchWithBQ('/catalogs/hotel-departments'),
    fetchWithBQ('/catalogs/positions'),
    fetchWithBQ('/catalogs/hiring-modalities'),
    fetchWithBQ('/catalogs/english-levels'),
  ])
  for (const res of [departmentsRes, positionsRes, modalitiesRes, englishRes]) {
    if (res.error) return { error: res.error }
  }

  return {
    data: {
      hotels: hotelsRes.error
        ? []
        : (hotelsRes.data as PaginatedEnvelope<HotelApi>).data
            .filter((hotel) => hotel.isClient)
            .map((hotel) => ({
              id: hotel.id,
              name: hotel.name,
              zoneName: hotel.zone.name.replace(/^Zona\s+/i, ''),
              photoUrl: hotel.photoUrl,
            })),
      departments: (departmentsRes.data as ApiEnvelope<CatalogItemApi[]>).data,
      positions: (positionsRes.data as ApiEnvelope<CatalogItemApi[]>).data,
      modalities: (modalitiesRes.data as ApiEnvelope<CatalogItemApi[]>).data,
      englishLevels: (englishRes.data as ApiEnvelope<CatalogItemApi[]>).data,
    },
  }
}

export const requisitionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRequisitionBoard: build.query<RequisitionBoard, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchBoard(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (board) => [
        { type: 'Requisition' as const, id: 'LIST' },
        ...(board?.items ?? []).map((item) => ({ type: 'Requisition' as const, id: item.id })),
      ],
    }),

    getRequisitionFormOptions: build.query<RequisitionFormOptions, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchFormOptions(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Catalog' as const, id: 'REQUISITION_FORM' }],
    }),

    /**
     * Las posiciones DEL departamento elegido: el catálogo agrupa por
     * departamento (Posiciones del vault) y el back ya filtra con
     * `?departmentId` — pedir un Chef para Housekeeping no es un pedido.
     */
    getPositionsForDepartment: build.query<CatalogItemApi[], string>({
      query: (departmentId) => ({ url: '/catalogs/positions', params: { departmentId } }),
      transformResponse: (raw: ApiEnvelope<CatalogItemApi[]>) => raw.data,
      providesTags: (_res, _err, departmentId) => [
        { type: 'Catalog' as const, id: `POSITIONS_${departmentId}` },
      ],
    }),

    getOwnHotelOption: build.query<RequisitionHotelOption, string>({
      query: (hotelId) => `/hotels/${hotelId}`,
      transformResponse: (raw: ApiEnvelope<HotelApi>): RequisitionHotelOption => ({
        id: raw.data.id,
        name: raw.data.name,
        zoneName: raw.data.zone.name.replace(/^Zona\s+/i, ''),
        photoUrl: raw.data.photoUrl,
      }),
      providesTags: (_res, _err, hotelId) => [{ type: 'Hotel' as const, id: hotelId }],
    }),

    /**
     * Eliminar = transición a Morado (encargo 10): el borrador lo quita su
     * creador sin motivo; una autorizada/en proceso, el Manager General con
     * motivo. La fila nunca se borra: GET /:id la sigue sirviendo.
     */
    deleteRequisition: build.mutation<unknown, { requisitionId: string; reason?: string }>({
      query: ({ requisitionId, reason }) => ({
        url: `/requisitions/${requisitionId}/delete`,
        method: 'POST',
        body: reason === undefined ? {} : { reason },
      }),
      invalidatesTags: (_res, _err, { requisitionId }) => [
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),

    createRequisition: build.mutation<unknown, CreateRequisitionRequest>({
      query: (body) => ({ url: '/requisitions', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
      ],
    }),

    getRequisition: build.query<RequisitionDetail, string>({
      queryFn: async (requisitionId, _api, _extra, fetchWithBQ) => {
        const [detailRes, assignmentsRes] = await Promise.all([
          fetchWithBQ(`/requisitions/${requisitionId}`),
          fetchWithBQ(`/requisitions/${requisitionId}/assignments`),
        ])
        if (detailRes.error) return { error: detailRes.error as never }
        const requisition = (detailRes.data as ApiEnvelope<RequisitionApi>).data
        const assignments = assignmentsRes.error
          ? []
          : (assignmentsRes.data as ApiEnvelope<AssignmentApi[]>).data
        return { data: toDetail(requisition, assignments) }
      },
      providesTags: (_detail, _error, requisitionId) => [
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),

    /**
     * Quién trabaja la requisición como equipo (RR-15): `requisitions:leave`
     * y la mitad «unirse» de `requisitions:take` estaban sembrados y con
     * endpoint real, pero nada en el front los llamaba — mismo hallazgo que
     * «Agregar turno» del Schedule.
     */
    getParticipants: build.query<RequisitionParticipant[], string>({
      queryFn: async (requisitionId, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const result = await bq(`/requisitions/${requisitionId}/participants`)
        if (result.error) return { error: result.error as never }
        const rows = (result.data as ApiEnvelope<ParticipantApi[]>).data
        return { data: rows.map(toParticipant) }
      },
      providesTags: (_res, _err, requisitionId) => [
        { type: 'Requisition' as const, id: `participants-${requisitionId}` },
      ],
    }),

    joinRequisition: build.mutation<RequisitionParticipant[], string>({
      queryFn: async (requisitionId, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const result = await bq({
          url: `/requisitions/${requisitionId}/participants`,
          method: 'POST',
        })
        if (result.error) return { error: result.error as never }
        const body = (result.data as ApiEnvelope<ParticipationResultApi>).data
        return { data: body.participants.map(toParticipant) }
      },
      invalidatesTags: (_res, _err, requisitionId) => [
        { type: 'Requisition' as const, id: `participants-${requisitionId}` },
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),

    leaveRequisition: build.mutation<RequisitionParticipant[], string>({
      queryFn: async (requisitionId, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const result = await bq({
          url: `/requisitions/${requisitionId}/participants/me`,
          method: 'DELETE',
        })
        if (result.error) return { error: result.error as never }
        const body = (result.data as ApiEnvelope<ParticipationResultApi>).data
        return { data: body.participants.map(toParticipant) }
      },
      invalidatesTags: (_res, _err, requisitionId) => [
        { type: 'Requisition' as const, id: `participants-${requisitionId}` },
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),
  }),
})

export const {
  useDeleteRequisitionMutation,
  useGetRequisitionBoardQuery,
  useGetRequisitionQuery,
  useGetRequisitionFormOptionsQuery,
  useGetPositionsForDepartmentQuery,
  useGetOwnHotelOptionQuery,
  useCreateRequisitionMutation,
  useGetParticipantsQuery,
  useJoinRequisitionMutation,
  useLeaveRequisitionMutation,
} = requisitionsApi
