import type {
  CreateRequisitionRequest,
  RequisitionBoard,
  RequisitionDetail,
  RequisitionFormOptions,
  RequisitionPosition,
  RequisitionRow,
  RequisitionSlot,
} from '../types/requisition.types'

import { registerRequisitionsMocks } from './requisitionsMocks'

import { baseApi } from '@/app/baseApi'
import type { RequisitionStatus, UrgencyLevel } from '@/shared/constants/requisitionStatus'
import type {
  ApiEnvelope,
  AssignmentApi,
  CatalogItemApi,
  HotelApi,
  PaginatedEnvelope,
  RequisitionApi,
  RequisitionPositionApi,
} from '@/shared/types/apiContract.types'

/**
 * Requisiciones sobre el contrato REAL de `demand`: `GET/POST /requisitions`,
 * `GET /requisitions/:id`, `POST /requisitions/:id/authorize` y las
 * asignaciones de `coverage`. Las métricas del tablero se calculan aquí — el
 * backend aún no las agrega (D-28: cuando exista el agregador, misma forma).
 */
registerRequisitionsMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const URGENCY_RANK: Record<string, number> = { RED: 0, YELLOW: 1, STRONG_GREEN: 2 }

/** La urgencia del tablero es la MÁS apremiante entre las posiciones. */
function worstUrgency(requisition: RequisitionApi): UrgencyLevel {
  const codes = requisition.positions
    .map((position) => position.urgency?.code)
    .filter((code): code is string => code !== undefined && code !== null)
  if (codes.length === 0) return 'STRONG_GREEN'
  return codes.sort((a, b) => (URGENCY_RANK[a] ?? 9) - (URGENCY_RANK[b] ?? 9))[0] as UrgencyLevel
}

/** El departamento de la fila: el de sus posiciones, o cuántos son si difieren. */
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
    /** El contrato solo da el id del inspector; su nombre aún no tiene endpoint. */
    inspectorName: '—',
  }
}

/**
 * Los slots por posición se sintetizan del conteo: `coverage` da las
 * asignaciones planas pero SIN la posición del slot, así que los nombres de
 * quienes ocupan no se pueden atribuir por posición sin adivinar. Se listan
 * ocupado/libre y el canal; el nombre queda para cuando el contrato lo exponga.
 */
function buildSlots(position: RequisitionPositionApi): RequisitionSlot[] {
  return Array.from({ length: position.quantity }, (_item, index) => {
    const isOccupied = index < position.filled
    return {
      id: `${position.id}-slot-${String(index + 1)}`,
      index: index + 1,
      status: isOccupied ? 'occupied' : 'free',
      assigneeName: null,
      assignedAt: null,
      offerChannel: isOccupied ? null : 'Visible en la Bolsa · Self-Pick',
    }
  })
}

function toPosition(position: RequisitionPositionApi): RequisitionPosition {
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
    slots: buildSlots(position),
  }
}

function toDetail(requisition: RequisitionApi, _assignments: AssignmentApi[]): RequisitionDetail {
  const positions = requisition.positions.map(toPosition)

  /** Historia mínima derivada de la entidad: el contrato no expone la tabla. */
  const history = [
    ...(requisition.authorizedAt
      ? [
          {
            id: `${requisition.id}-authorized`,
            fromStatus: 'APPLE_GREEN' as RequisitionStatus,
            toStatus: 'GREEN' as RequisitionStatus,
            action: 'Autorizada',
            byName: '—',
            at: requisition.authorizedAt,
          },
        ]
      : []),
    {
      id: `${requisition.id}-created`,
      fromStatus: null,
      toStatus: 'APPLE_GREEN' as RequisitionStatus,
      action: 'Creada',
      byName: '—',
      at: requisition.createdAt,
    },
  ]

  return {
    id: requisition.id,
    number: requisition.number,
    hotelName: requisition.hotel.name,
    department: rowDepartment(requisition),
    status: requisition.state.code as RequisitionStatus,
    createdByName: '—',
    createdAt: requisition.createdAt,
    authorizedByName: requisition.authorizedAt ? '—' : null,
    authorizedAt: requisition.authorizedAt,
    inspectorName: '—',
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

async function fetchBoard(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: RequisitionBoard } | { error: unknown }> {
  const listRes = await fetchWithBQ({ url: '/requisitions', params: { limit: 100 } })
  if (listRes.error) return { error: listRes.error }
  const requisitions = (listRes.data as PaginatedEnvelope<RequisitionApi>).data

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
  for (const res of [hotelsRes, departmentsRes, positionsRes, modalitiesRes, englishRes]) {
    if (res.error) return { error: res.error }
  }

  return {
    data: {
      /** Solo los clientes activos generan requisiciones (entran a `vw_client`). */
      hotels: (hotelsRes.data as PaginatedEnvelope<HotelApi>).data
        .filter((hotel) => hotel.isClient)
        .map((hotel) => ({
          id: hotel.id,
          name: hotel.name,
          zoneName: hotel.zone.name.replace(/^Zona\s+/i, ''),
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

    /** Catálogos del alta: `/catalogs/*` + los hoteles cliente. */
    getRequisitionFormOptions: build.query<RequisitionFormOptions, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchFormOptions(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Catalog' as const, id: 'REQUISITION_FORM' }],
    }),

    createRequisition: build.mutation<unknown, CreateRequisitionRequest>({
      query: (body) => ({ url: '/requisitions', method: 'POST', body }),
      /** Cambia el tablero y su métrica de «por autorizar», así que se invalida entero. */
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
  }),
})

export const {
  useGetRequisitionBoardQuery,
  useGetRequisitionQuery,
  useGetRequisitionFormOptionsQuery,
  useCreateRequisitionMutation,
} = requisitionsApi
