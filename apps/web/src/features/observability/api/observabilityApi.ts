import type { ProspectAttempt } from '../lib/people'
import type { DepartmentMetric, Punch, StatusLightSummary } from '../types/observability.types'

import { baseApi } from '@/app/baseApi'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type {
  ApiEnvelope,
  AssignmentApi,
  ContactAttemptApi,
  HotelApi,
  PaginatedEnvelope,
  ProspectApi,
  RequisitionApi,
  RequisitionJournalEntryApi,
  TimesheetApi,
  WorkerApi,
} from '@/shared/types/apiContract.types'

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** `fetchAllPages` corta en 20 páginas de 100: si se llega, la lista está truncada. */
const FETCH_ALL_CAP = 2000

/** Una semana de ponches de todos los hoteles cabe de sobra; más es otro tablero. */
const PUNCH_MAX_PAGES = 30

/** Llamadas por detalle (intentos, asignaciones) en paralelo, por tandas. */
const BATCH_SIZE = 8

export interface Listed<T> {
  rows: T[]
  /** Se alcanzó el tope de páginas: los números se calculan sobre una parte. */
  truncated: boolean
}

function listed<T>(rows: T[]): Listed<T> {
  return { rows, truncated: rows.length >= FETCH_ALL_CAP }
}

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    results.push(...(await Promise.all(items.slice(index, index + BATCH_SIZE).map(run))))
  }
  return results
}

/**
 * Observador (`ROL-OBS-01`, Roles del Sistema.md 2026-09-21): transversal, de
 * solo lectura. Los KPIs por departamento se componen en el front con las
 * listas que el Observador ya puede leer (`pipeline:read_all`,
 * `requisitions:read_all`, `recruitment:search_candidates`,
 * `timesheet:read_all_hotels`, `observability:*`), sin endpoint nuevo.
 *
 * Sin `providesTags`/`invalidatesTags`: todo es de solo lectura y ninguna
 * mutación de la app escribe desde aquí (D-12).
 */
export const observabilityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStatusDurations: build.query<StatusLightSummary[], void>({
      query: () => '/observability/status-durations',
      transformResponse: (raw: ApiEnvelope<StatusLightSummary[]>) => raw.data,
    }),

    getDepartmentMetrics: build.query<DepartmentMetric[], void>({
      query: () => '/observability/department-metrics',
      transformResponse: (raw: ApiEnvelope<DepartmentMetric[]>) => raw.data,
    }),

    /** Con los cerrados: la conversión y la pérdida se miden sobre ciclos terminados. */
    getObserverProspects: build.query<Listed<ProspectApi>, void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const res = await fetchAllPages<ProspectApi>(fetchWithBQ, '/prospects', {
          includeClosed: true,
        })
        return 'error' in res ? { error: res.error as never } : { data: listed(res.data) }
      },
    }),

    getObserverClientHotels: build.query<Listed<HotelApi>, void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const res = await fetchAllPages<HotelApi>(fetchWithBQ, '/hotels', { onlyClients: true })
        return 'error' in res ? { error: res.error as never } : { data: listed(res.data) }
      },
    }),

    /** Con las eliminadas. Ojo: el back lee `includeDeleted` con `coerce`, así que «false» sería true. */
    getObserverRequisitions: build.query<Listed<RequisitionApi>, void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const res = await fetchAllPages<RequisitionApi>(fetchWithBQ, '/requisitions', {
          includeDeleted: true,
        })
        return 'error' in res ? { error: res.error as never } : { data: listed(res.data) }
      },
    }),

    getObserverWorkers: build.query<Listed<WorkerApi>, void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const res = await fetchAllPages<WorkerApi>(fetchWithBQ, '/workers')
        return 'error' in res ? { error: res.error as never } : { data: listed(res.data) }
      },
    }),

    /** Semanas enviadas al hotel y sin aprobar, de todos los hoteles (`read_all_hotels`). */
    getObserverPendingWeeks: build.query<number, void>({
      query: () => ({ url: '/timesheets', params: { status: 'PENDING_APPROVAL' } }),
      transformResponse: (raw: ApiEnvelope<TimesheetApi[]>) => raw.data.length,
    }),

    /**
     * Los ponches no se filtran por fecha en el API: vienen del más reciente
     * al más viejo. Se pide página tras página hasta pasar el inicio del
     * periodo, con tope.
     */
    getObserverPunchesSince: build.query<Listed<Punch>, string>({
      async queryFn(fromIso, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const from = new Date(fromIso).getTime()
        const rows: Punch[] = []
        for (let page = 1; page <= PUNCH_MAX_PAGES; page += 1) {
          const res = await fetchWithBQ({
            url: '/observability/punches',
            params: { page, limit: 100 },
          })
          if (res.error) return { error: res.error as never }
          const envelope = res.data as PaginatedEnvelope<Punch>
          rows.push(...envelope.data.filter((punch) => new Date(punch.serverAt).getTime() >= from))
          const oldest = envelope.data[envelope.data.length - 1]
          const reachedStart = !oldest || new Date(oldest.serverAt).getTime() < from
          if (reachedStart || page >= envelope.meta.totalPages) {
            return { data: { rows, truncated: false } }
          }
        }
        return { data: { rows, truncated: true } }
      },
    }),

    /** Los intentos de contacto de los prospectos dados (los que se movieron en el periodo). */
    /** Cada intento lleva el `prospectId` de donde salió: el intento no lo trae. */
    getObserverContactAttempts: build.query<ProspectAttempt[], string[]>({
      async queryFn(prospectIds, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const results = await inBatches(prospectIds, async (id) => ({
          id,
          res: await fetchWithBQ(`/prospects/${id}/contact-attempts`),
        }))
        const failed = results.find(({ res }) => res.error)
        if (failed) return { error: failed.res.error as never }
        return {
          data: results.flatMap(({ id, res }) =>
            (res.data as { data: ContactAttemptApi[] }).data.map((attempt) => ({
              ...attempt,
              prospectId: id,
            })),
          ),
        }
      },
    }),

    /** Bitácora por requisición, para la actividad de cada reclutador. */
    getObserverJournals: build.query<Record<string, RequisitionJournalEntryApi[]>, string[]>({
      async queryFn(requisitionIds, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const results = await inBatches(requisitionIds, async (id) => ({
          id,
          res: await fetchWithBQ(`/requisitions/${id}/journal`),
        }))
        const failed = results.find(({ res }) => res.error)
        if (failed) return { error: failed.res.error as never }
        return {
          data: Object.fromEntries(
            results.map(({ id, res }) => [
              id,
              (res.data as ApiEnvelope<RequisitionJournalEntryApi[]>).data,
            ]),
          ),
        }
      },
    }),

    /** Asignaciones por requisición, para el no-show del día 1. */
    getObserverAssignments: build.query<Record<string, AssignmentApi[]>, string[]>({
      async queryFn(requisitionIds, _api, _extra, baseQuery) {
        const fetchWithBQ = baseQuery as FetchWithBQ
        const results = await inBatches(requisitionIds, async (id) => ({
          id,
          res: await fetchWithBQ(`/requisitions/${id}/assignments`),
        }))
        const failed = results.find(({ res }) => res.error)
        if (failed) return { error: failed.res.error as never }
        return {
          data: Object.fromEntries(
            results.map(({ id, res }) => [id, (res.data as ApiEnvelope<AssignmentApi[]>).data]),
          ),
        }
      },
    }),
  }),
})

export const {
  useGetStatusDurationsQuery,
  useGetDepartmentMetricsQuery,
  useGetObserverProspectsQuery,
  useGetObserverClientHotelsQuery,
  useGetObserverRequisitionsQuery,
  useGetObserverWorkersQuery,
  useGetObserverPendingWeeksQuery,
  useGetObserverPunchesSinceQuery,
  useGetObserverContactAttemptsQuery,
  useGetObserverAssignmentsQuery,
  useGetObserverJournalsQuery,
} = observabilityApi
