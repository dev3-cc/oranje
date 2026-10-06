import { baseApi } from '@/app/baseApi'
import type { RequisitionStatus, UrgencyLevel } from '@/shared/constants/requisitionStatus'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type {
  ApiEnvelope,
  AssignmentApi,
  CatalogItemApi,
  RequisitionApi,
  RequisitionPositionApi,
} from '@/shared/types/apiContract.types'

/**
 * Requisiciones del hotel en la app. Los MISMOS endpoints que usa el web
 * (`features/requisitions/api`) —por eso el comportamiento y los permisos son
 * idénticos—, con su propia capa porque las reglas de ESLint no dejan
 * importar el interior de una feature (§4). El alcance (hotel, departamento)
 * lo aplica el API con la sesión: aquí no se manda `hotelId` al listar.
 *
 * Los endpoints llevan el prefijo `app` para no chocar con los del web si
 * algún día conviven en un mismo bundle.
 */

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const URGENCY_RANK: Record<string, number> = { RED: 0, YELLOW: 1, STRONG_GREEN: 2 }

export interface AppRequisitionRow {
  id: string
  number: string
  department: string
  status: RequisitionStatus
  filled: number
  total: number
  /** La urgencia de la posición más apurada (la manda el backend, RR-H-05). */
  urgency: UrgencyLevel
  /** La posición que empieza primero. */
  startDate: string | null
  createdByName: string | null
  createdAt: string
  authorizedAt: string | null
  /** Lugares sin cubrir por departamento (para la demanda del Inicio). */
  openByDepartment: Array<{ department: string; open: number }>
}

export interface AppRequisitionSlot {
  ordinal: number
  workerName: string | null
}

export interface AppRequisitionPosition {
  id: string
  lineNumber: number
  name: string
  department: string
  modality: string
  english: string | null
  quantity: number
  filled: number
  startDate: string
  startTime: string | null
  urgency: UrgencyLevel
  slots: AppRequisitionSlot[]
}

export interface AppRequisitionDetail {
  id: string
  number: string
  hotelName: string
  department: string
  status: RequisitionStatus
  filled: number
  total: number
  createdByName: string | null
  createdAt: string
  authorizedByName: string | null
  authorizedAt: string | null
  inspectorName: string | null
  positions: AppRequisitionPosition[]
}

export interface AppRequisitionCatalogs {
  departments: CatalogItemApi[]
  modalities: CatalogItemApi[]
  englishLevels: CatalogItemApi[]
}

export interface AppCreateRequisitionRequest {
  hotelId: string
  positions: Array<{
    catalogPositionId: string
    hiringModalityId: string
    hotelDepartmentId: string
    englishLevelId?: string
    quantity: number
    startDate: string
    startTime: string
  }>
}

function worstUrgency(requisition: RequisitionApi): UrgencyLevel {
  const codes = requisition.positions
    .map((position) => position.urgency?.code)
    .filter((code): code is string => typeof code === 'string')
  if (codes.length === 0) return 'STRONG_GREEN'
  return codes.sort((a, b) => (URGENCY_RANK[a] ?? 9) - (URGENCY_RANK[b] ?? 9))[0] as UrgencyLevel
}

function departmentsOf(requisition: RequisitionApi): string {
  const names = [...new Set(requisition.positions.map((position) => position.department.name))]
  if (names.length === 0) return '—'
  if (names.length === 1) return names[0] as string
  return `${names[0] as string} +${String(names.length - 1)}`
}

function toRow(requisition: RequisitionApi): AppRequisitionRow {
  return {
    id: requisition.id,
    number: requisition.number,
    department: departmentsOf(requisition),
    status: requisition.state.code as RequisitionStatus,
    filled: requisition.filledSlots,
    total: requisition.totalSlots,
    urgency: worstUrgency(requisition),
    startDate: requisition.positions.map((position) => position.startDate).sort()[0] ?? null,
    createdByName: requisition.createdBy?.fullName ?? null,
    createdAt: requisition.createdAt,
    authorizedAt: requisition.authorizedAt,
    openByDepartment: [
      ...requisition.positions
        .reduce((byDepartment, position) => {
          const name = position.department.name
          const open = Math.max(position.quantity - position.filled, 0)
          return byDepartment.set(name, (byDepartment.get(name) ?? 0) + open)
        }, new Map<string, number>())
        .entries(),
    ].map(([department, open]) => ({ department, open })),
  }
}

/**
 * Quién ocupa cada lugar: las asignaciones ACTIVAS se casan por ordinal del
 * slot, igual que en el web (el contrato no dice a qué posición pertenece cada
 * una: exacto con una posición, aproximado con varias).
 */
function toPosition(
  position: RequisitionPositionApi,
  pool: AssignmentApi[],
): AppRequisitionPosition {
  const slots = Array.from({ length: position.quantity }, (_item, index): AppRequisitionSlot => {
    if (index >= position.filled) return { ordinal: index + 1, workerName: null }
    const byOrdinal = pool.findIndex((item) => item.slot.ordinal === index + 1)
    const at = byOrdinal >= 0 ? byOrdinal : 0
    const assignment = pool[at]
    if (assignment) pool.splice(at, 1)
    return { ordinal: index + 1, workerName: assignment?.worker.fullName ?? null }
  })
  return {
    id: position.id,
    lineNumber: position.lineNumber,
    name: position.position.name,
    department: position.department.name,
    modality: position.hiringModality.name,
    english: position.englishLevel?.name ?? null,
    quantity: position.quantity,
    filled: position.filled,
    startDate: position.startDate,
    startTime: position.startTime,
    urgency: (position.urgency?.code ?? 'STRONG_GREEN') as UrgencyLevel,
    slots,
  }
}

function toDetail(requisition: RequisitionApi, assignments: AssignmentApi[]): AppRequisitionDetail {
  const pool = assignments.filter((item) => item.status === 'ACTIVE')
  return {
    id: requisition.id,
    number: requisition.number,
    hotelName: requisition.hotel.name,
    department: departmentsOf(requisition),
    status: requisition.state.code as RequisitionStatus,
    filled: requisition.filledSlots,
    total: requisition.totalSlots,
    createdByName: requisition.createdBy?.fullName ?? null,
    createdAt: requisition.createdAt,
    authorizedByName: requisition.authorizedAt ? (requisition.authorizer?.fullName ?? null) : null,
    authorizedAt: requisition.authorizedAt,
    inspectorName: requisition.inspector?.fullName ?? null,
    positions: requisition.positions
      .slice()
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((position) => toPosition(position, pool)),
  }
}

export const requisitionsAppApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    appRequisitions: build.query<AppRequisitionRow[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchAllPages<RequisitionApi>(
          fetchWithBQ as FetchWithBQ,
          '/requisitions',
        )
        if ('error' in result) return { error: result.error as never }
        const rows = result.data.map(toRow)
        /* Lo más reciente arriba: es lo que el hotel acaba de pedir o firmar. */
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        return { data: rows }
      },
      providesTags: (rows) => [
        { type: 'Requisition' as const, id: 'LIST' },
        ...(rows ?? []).map((row) => ({ type: 'Requisition' as const, id: row.id })),
      ],
    }),

    appRequisition: build.query<AppRequisitionDetail, string>({
      queryFn: async (requisitionId, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const [detailRes, assignmentsRes] = await Promise.all([
          bq(`/requisitions/${requisitionId}`),
          bq(`/requisitions/${requisitionId}/assignments`),
        ])
        if (detailRes.error) return { error: detailRes.error as never }
        const requisition = (detailRes.data as ApiEnvelope<RequisitionApi>).data
        const assignments = assignmentsRes.error
          ? []
          : (assignmentsRes.data as ApiEnvelope<AssignmentApi[]>).data
        return { data: toDetail(requisition, assignments) }
      },
      providesTags: (_res, _err, requisitionId) => [
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),

    appRequisitionCatalogs: build.query<AppRequisitionCatalogs, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const [departments, modalities, english] = await Promise.all([
          bq('/catalogs/hotel-departments'),
          bq('/catalogs/hiring-modalities'),
          bq('/catalogs/english-levels'),
        ])
        for (const res of [departments, modalities, english]) {
          if (res.error) return { error: res.error as never }
        }
        return {
          data: {
            departments: (departments.data as ApiEnvelope<CatalogItemApi[]>).data,
            modalities: (modalities.data as ApiEnvelope<CatalogItemApi[]>).data,
            englishLevels: (english.data as ApiEnvelope<CatalogItemApi[]>).data,
          },
        }
      },
      providesTags: [{ type: 'Catalog' as const, id: 'APP_REQUISITION_FORM' }],
    }),

    /** Los puestos DEL departamento: pedir un Chef para Housekeeping no es un pedido. */
    appPositionsForDepartment: build.query<CatalogItemApi[], string>({
      query: (departmentId) => ({ url: '/catalogs/positions', params: { departmentId } }),
      transformResponse: (raw: ApiEnvelope<CatalogItemApi[]>) => raw.data,
      providesTags: (_res, _err, departmentId) => [
        { type: 'Catalog' as const, id: `POSITIONS_${departmentId}` },
      ],
    }),

    appCreateRequisition: build.mutation<{ id: string | null }, AppCreateRequisitionRequest>({
      query: (body) => ({ url: '/requisitions', method: 'POST', body }),
      transformResponse: (raw: ApiEnvelope<Partial<RequisitionApi>> | undefined) => ({
        id: raw?.data?.id ?? null,
      }),
      invalidatesTags: [
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
      ],
    }),

    appAuthorizeRequisition: build.mutation<unknown, string>({
      query: (requisitionId) => ({
        url: `/requisitions/${requisitionId}/authorize`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, requisitionId) => [
        { type: 'Requisition' as const, id: 'AUTHORIZATION_QUEUE' },
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Requisition' as const, id: requisitionId },
      ],
    }),

    /** Eliminar = pasar a Morado; de Autorizada en adelante, con motivo (queda en el journal). */
    appDeleteRequisition: build.mutation<unknown, { requisitionId: string; reason?: string }>({
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
  }),
})

export const {
  useAppRequisitionsQuery,
  useAppRequisitionQuery,
  useAppRequisitionCatalogsQuery,
  useAppPositionsForDepartmentQuery,
  useAppCreateRequisitionMutation,
  useAppAuthorizeRequisitionMutation,
  useAppDeleteRequisitionMutation,
} = requisitionsAppApi
