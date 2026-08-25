import type {
  AssignableWorker,
  CreateAssignmentRequest,
  SelfPickBoard,
  SelfPickRow,
  SlotBoard,
  SlotRow,
} from '../types/selfPick.types'

import { registerPoolMocks } from './poolMocks'

import { baseApi } from '@/app/baseApi'
/*
 * ⚠ Import entre features, permitido SOLO para registrar mocks: las
 * requisiciones de la bolsa las registra Requisiciones. Apagados, es un no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerRequisitionsMocks } from '@/features/requisitions/api/requisitionsMocks'
import type {
  ApiEnvelope,
  AssignmentApi,
  PaginatedEnvelope,
  RequisitionApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

/**
 * La Bolsa Self-Pick COMPONE el contrato real (D-28): `GET /requisitions`
 * para los renglones con slots libres, `GET /requisitions/:id/assignments`
 * para los ocupantes y `POST /assignments` para tomar el slot — el 409 del
 * motor ES la regla RR-15, aquí solo se traduce.
 */
registerRequisitionsMocks()
registerPoolMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** Estados donde la bolsa aplica: autorizada (GREEN) y en proceso (YELLOW). */
const TAKEABLE_STATES = new Set(['GREEN', 'YELLOW'])

function toRows(requisition: RequisitionApi): SelfPickRow[] {
  return requisition.positions
    .filter((position) => position.quantity > position.filled)
    .map((position) => ({
      requisitionId: requisition.id,
      requisitionNumber: requisition.number,
      requisitionState: requisition.state.code,
      positionId: position.id,
      lineNumber: position.lineNumber,
      positionName: position.position.name,
      positionCatalogId: position.position.id,
      hotelName: requisition.hotel.name,
      departmentName: position.department.name,
      startDate: position.startDate,
      startTime: position.startTime,
      modalityName: position.hiringModality.name,
      modalityId: position.hiringModality.id,
      englishName: position.englishLevel?.name ?? null,
      englishId: position.englishLevel?.id ?? null,
      quantity: position.quantity,
      freeSlots: position.quantity - position.filled,
    }))
}

async function fetchBoard(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: SelfPickBoard } | { error: unknown }> {
  const result = await fetchWithBQ({ url: '/requisitions', params: { limit: 100 } })
  if (result.error) return { error: result.error }

  const requisitions = (result.data as PaginatedEnvelope<RequisitionApi>).data.filter(
    (requisition) => TAKEABLE_STATES.has(requisition.state.code),
  )
  const rows = requisitions.flatMap(toRows).sort((a, b) => a.startDate.localeCompare(b.startDate))

  return {
    data: {
      rows,
      totalFreeSlots: rows.reduce((total, row) => total + row.freeSlots, 0),
      totalRequisitions: new Set(rows.map((row) => row.requisitionId)).size,
    },
  }
}

async function fetchSlotBoard(
  fetchWithBQ: FetchWithBQ,
  requisitionId: string,
  positionId: string,
): Promise<{ data: SlotBoard } | { error: unknown }> {
  const [requisitionRes, assignmentsRes] = await Promise.all([
    fetchWithBQ(`/requisitions/${requisitionId}`),
    fetchWithBQ(`/requisitions/${requisitionId}/assignments`),
  ])
  if (requisitionRes.error) return { error: requisitionRes.error }
  if (assignmentsRes.error) return { error: assignmentsRes.error }

  const requisition = (requisitionRes.data as ApiEnvelope<RequisitionApi>).data
  const assignments = (assignmentsRes.data as ApiEnvelope<AssignmentApi[]>).data
  const position = requisition.positions.find((item) => item.id === positionId)
  if (!position) {
    return { error: { status: 404, data: { message: 'El renglón no existe' } } }
  }

  /**
   * Un slot por unidad de `quantity` (demand.slot). El contrato no expone la
   * tabla de slots directa: se reconstruye con las asignaciones ACTIVAS de
   * esta posición, que traen el ordinal de su slot.
   */
  const activeByOrdinal = new Map<number, AssignmentApi>()
  for (const assignment of assignments) {
    if (assignment.status === 'ACTIVE' && assignment.slot.id.includes(position.id)) {
      activeByOrdinal.set(assignment.slot.ordinal, assignment)
    }
  }
  /** Fallback honesto: si los ids de slot no delatan la posición, por conteo. */
  const occupied =
    activeByOrdinal.size > 0
      ? activeByOrdinal
      : new Map(
          assignments
            .filter((item) => item.status === 'ACTIVE')
            .slice(0, position.filled)
            .map((item) => [item.slot.ordinal, item] as const),
        )

  const slots: SlotRow[] = Array.from({ length: position.quantity }, (_, index) => {
    const assignment = occupied.get(index + 1)
    return {
      ordinal: index + 1,
      workerName: assignment?.worker.fullName ?? null,
      assignmentType: assignment?.type ?? null,
    }
  })
  const firstFree = slots.find((slot) => slot.workerName === null)

  return {
    data: {
      requisitionId: requisition.id,
      requisitionNumber: requisition.number,
      requisitionState: { code: requisition.state.code, name: requisition.state.name },
      hotelName: requisition.hotel.name,
      lineNumber: position.lineNumber,
      positionName: position.position.name,
      coverage: { code: position.coverage.code, name: position.coverage.name },
      slots,
      freeSlots: position.quantity - position.filled,
      nextFreeOrdinal: firstFree?.ordinal ?? null,
    },
  }
}

export const selfPickApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSelfPickBoard: build.query<SelfPickBoard, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchBoard(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Requisition' as const, id: 'SELF_PICK' }],
    }),

    getSlotBoard: build.query<SlotBoard, { requisitionId: string; positionId: string }>({
      queryFn: async ({ requisitionId, positionId }, _api, _extra, fetchWithBQ) => {
        const result = await fetchSlotBoard(fetchWithBQ as FetchWithBQ, requisitionId, positionId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (_res, _err, { positionId }) => [
        { type: 'Requisition' as const, id: `slots-${positionId}` },
      ],
    }),

    /** Elegibles para asignar: los Disponibles del Pool (STRONG_GREEN). */
    getAssignableWorkers: build.query<AssignableWorker[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const result = await bq({
          url: '/workers',
          params: { state: 'STRONG_GREEN', limit: 100 },
        })
        if (result.error) return { error: result.error as never }
        const workers = (result.data as PaginatedEnvelope<WorkerApi>).data
        return {
          data: workers.map((worker) => ({
            id: worker.id,
            fullName: worker.fullName,
            zoneName: worker.zone.name,
            stateCode: worker.state.code,
          })),
        }
      },
      providesTags: [{ type: 'Worker' as const, id: 'LIST' }],
    }),

    createAssignment: build.mutation<unknown, CreateAssignmentRequest>({
      query: (body) => ({ url: '/assignments', method: 'POST', body }),
      invalidatesTags: (_res, _err, { positionId }) => [
        { type: 'Requisition' as const, id: 'SELF_PICK' },
        { type: 'Requisition' as const, id: `slots-${positionId}` },
        { type: 'Requisition' as const, id: 'LIST' },
        { type: 'Worker' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetSelfPickBoardQuery,
  useGetSlotBoardQuery,
  useGetAssignableWorkersQuery,
  useCreateAssignmentMutation,
} = selfPickApi
