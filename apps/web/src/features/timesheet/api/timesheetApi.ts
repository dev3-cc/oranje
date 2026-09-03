import { addDaysIso, resolveWeek } from '../lib/weekNavigation'
import {
  ANY_VALUE,
  type ReviewDayRequest,
  type TimesheetEntry,
  type TimesheetFilters,
  type TimelineRow,
  type TimesheetMonth,
  type TimesheetMonthDay,
  type TimesheetTimeline,
  type TimesheetPunch,
  type TimesheetRow,
  type TimesheetWeek,
} from '../types/timesheet.types'

import { registerTimesheetMocks } from './timesheetMocks'

import { baseApi } from '@/app/baseApi'
import type { TimesheetStatus } from '@/shared/constants/timesheetStatus'
import type {
  ApiEnvelope,
  TimesheetApi,
  TimesheetDayApi,
  TimesheetPunchApi,
} from '@/shared/types/apiContract.types'

/**
 * El Timesheet sobre el contrato REAL de `operations`: `GET /timesheets`
 * (scoped por el hotel/departamento de quien pregunta, D-09) + el detalle por
 * timesheet con días y marcas. Revisar un día es `POST /timesheet-days/:id/review`,
 * que es el paso del Supervisor; enviar y aprobar son del flujo de D-09.
 */
registerTimesheetMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000

function timeOf(iso: string): string {
  return iso.slice(11, 16)
}

/** Lo que el Timesheet necesita saber de cada requisición: folio y hotel. */
interface RequisitionRefInfo {
  number: string
  hotelName: string
  hotelPhotoUrl: string | null
}

/**
 * Índice id → folio/hotel desde `/requisitions` (composición D-28). Tolerante
 * a fallos: sin él, el folio cae al id recortado y el hotel al de `/me`
 * (criterio D-30 — un dato de adorno no tumba la pantalla).
 */
async function fetchRequisitionIndex(
  fetchWithBQ: FetchWithBQ,
): Promise<Map<string, RequisitionRefInfo>> {
  const index = new Map<string, RequisitionRefInfo>()
  const res = await fetchWithBQ('/requisitions')
  if (res.error) return index
  const items = (
    res.data as ApiEnvelope<
      Array<{ id: string; number: string; hotel: { name: string; photoUrl?: string | null } }>
    >
  ).data
  for (const item of items) {
    index.set(item.id, {
      number: item.number,
      hotelName: item.hotel.name,
      hotelPhotoUrl: item.hotel.photoUrl ?? null,
    })
  }
  return index
}

/** El folio REAL si el índice lo tiene; si no, el id recortado (fallback honesto). */
function requisitionRefOf(index: Map<string, RequisitionRefInfo>, requisitionId: string): string {
  return index.get(requisitionId)?.number ?? `req ${requisitionId.slice(0, 8)}`
}

function toPunch(punch: TimesheetPunchApi): TimesheetPunch {
  return {
    id: punch.id,
    type: punch.type,
    serverTime: timeOf(punch.serverAt),
    deviceTime: punch.deviceAt ? timeOf(punch.deviceAt) : null,
    insideGeofence: punch.insideGeofence,
    isManual: punch.isManual,
    manualReason: punch.manualReason,
  }
}

/** El estado del día se DERIVA: anomalía sin resolver, nota escrita, o pendiente. */
function dayStatus(day: TimesheetDayApi): TimesheetStatus {
  if (day.hasAnomaly && day.reviewNote === null) return 'OBSERVED'
  if (day.reviewNote !== null) return 'REVIEWED'
  return 'PENDING'
}

function toEntry(day: TimesheetDayApi, requisitionRef: string): TimesheetEntry {
  const punches = day.punches.map(toPunch)
  const clockIn = punches.find((punch) => punch.type === 'CLOCK_IN')
  const clockOut = punches.find((punch) => punch.type === 'CLOCK_OUT')

  return {
    id: day.id,
    date: day.workDate,
    status: dayStatus(day),
    hours: day.isAbsence ? null : Math.round((day.netMinutes / 60) * 100) / 100,
    startTime: clockIn?.serverTime ?? null,
    endTime: clockOut?.serverTime ?? null,
    requisitionNumber: requisitionRef,
    punch: clockIn && clockOut ? 'COMPLETE' : punches.length > 0 ? 'INCOMPLETE' : 'NO_SHIFT',
    hasAnomaly: day.hasAnomaly,
    isAbsence: day.isAbsence,
    reviewNote: day.reviewNote,
    punches,
  }
}

async function fetchWeek(
  fetchWithBQ: FetchWithBQ,
  filters: TimesheetFilters,
): Promise<{ data: TimesheetWeek } | { error: unknown }> {
  const [listRes, meRes, requisitionIndex] = await Promise.all([
    fetchWithBQ({
      url: '/timesheets',
      params: { ...(filters.status !== ANY_VALUE ? { status: filters.status } : {}) },
    }),
    fetchWithBQ('/me'),
    fetchRequisitionIndex(fetchWithBQ),
  ])
  if (listRes.error) return { error: listRes.error }
  if (meRes.error) return { error: meRes.error }

  const timesheets = (listRes.data as ApiEnvelope<TimesheetApi[]>).data
  const me = (meRes.data as ApiEnvelope<{ hotel: { name: string } | null }>).data
  const fallbackHotel = me.hotel?.name ?? '—'

  if (timesheets.length === 0) {
    return {
      data: {
        days: [],
        rows: [],
        requisitionNumbers: [],
        hotelNames: [],
        weekStart: '',
        availableWeeks: [],
      },
    }
  }

  /**
   * La pantalla es UNA semana. Las disponibles salen de lo que llegó (el
   * contrato no pagina por fecha) y se enseña la pedida o, sin petición
   * válida, la más reciente.
   */
  const availableWeeks = [...new Set(timesheets.map((sheet) => sheet.weekStart))].sort()
  const weekStart = resolveWeek(availableWeeks, filters.weekStart) as string
  const ofWeek = timesheets.filter((sheet) => sheet.weekStart === weekStart)
  const days = Array.from({ length: 7 }, (_item, index) =>
    new Date(new Date(weekStart).getTime() + index * MS_PER_DAY).toISOString().slice(0, 10),
  )

  /** Días y marcas viven en el detalle: se piden en paralelo (D-28). */
  const details = await Promise.all(ofWeek.map((sheet) => fetchWithBQ(`/timesheets/${sheet.id}`)))

  const rows: TimesheetRow[] = []
  for (const [index, sheet] of ofWeek.entries()) {
    const detailRes = details[index]
    if (!detailRes || detailRes.error) continue
    const detail = (detailRes.data as ApiEnvelope<TimesheetApi>).data
    /** El folio REAL sale del índice de requisiciones (ya no el id recortado). */
    const requisitionRef = requisitionRefOf(requisitionIndex, detail.requisitionId)

    rows.push({
      timesheetId: sheet.id,
      requisitionId: detail.requisitionId,
      workerId: detail.worker.id,
      workerName: detail.worker.fullName,
      jobTitle: '—',
      hotelName: requisitionIndex.get(detail.requisitionId)?.hotelName ?? fallbackHotel,
      weekStatus: detail.status,
      totalHours: Math.round(((detail.totals?.netMinutes ?? 0) / 60) * 100) / 100,
      targetHours: null,
      entries: (detail.days ?? []).map((day) => toEntry(day, requisitionRef)),
    })
  }

  const requisitionNumbers = [
    ...new Set(rows.flatMap((row) => row.entries.map((entry) => entry.requisitionNumber ?? ''))),
  ].filter(Boolean)

  const visible = rows.filter((row) => {
    if (filters.search && !row.workerName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }
    if (
      filters.requisitionNumber !== ANY_VALUE &&
      !row.entries.some((entry) => entry.requisitionNumber === filters.requisitionNumber)
    ) {
      return false
    }
    if (filters.hotelName !== ANY_VALUE && row.hotelName !== filters.hotelName) return false
    return true
  })

  return {
    data: {
      days,
      rows: visible,
      requisitionNumbers,
      hotelNames: [...new Set(rows.map((row) => row.hotelName))].filter((name) => name !== '—'),
      weekStart,
      availableWeeks,
    },
  }
}

/**
 * La CINTA continua de la vista Días: TODAS las semanas cargadas de una vez,
 * con las filas fusionadas por persona × requisición y sus días en una sola
 * línea de tiempo. Navegar de semana ya no refetchea nada — solo mueve la
 * ventana — y por eso las fechas vecinas pueden entrar EN VIVO al arrastrar.
 * ⚠ El caller debe pasar `weekStart: ANY_VALUE` para que la llave de caché no
 * cambie al navegar.
 */
async function fetchTimeline(
  fetchWithBQ: FetchWithBQ,
  filters: TimesheetFilters,
): Promise<{ data: TimesheetTimeline } | { error: unknown }> {
  const [listRes, meRes, workersRes, requisitionIndex] = await Promise.all([
    fetchWithBQ({
      url: '/timesheets',
      params: { ...(filters.status !== ANY_VALUE ? { status: filters.status } : {}) },
    }),
    fetchWithBQ('/me'),
    /* Composición D-28: `/workers` trae la foto Y el puesto de la persona; el
       índice de requisiciones trae folio real y hotel (nombre + foto, D-34).
       Si algo de esto falla, la fila degrada con fallbacks (criterio D-30). */
    fetchWithBQ({ url: '/workers', params: { limit: 100 } }),
    fetchRequisitionIndex(fetchWithBQ),
  ])
  if (listRes.error) return { error: listRes.error }
  if (meRes.error) return { error: meRes.error }

  const timesheets = (listRes.data as ApiEnvelope<TimesheetApi[]>).data
  const me = (meRes.data as ApiEnvelope<{ hotel: { name: string } | null }>).data
  const fallbackHotel = me.hotel?.name ?? '—'

  const workerInfo = new Map<string, { photoUrl: string | null; jobTitle: string }>()
  if (!workersRes.error) {
    const workers = (
      workersRes.data as {
        data: Array<{ id: string; photoUrl: string | null; position: { name: string } | null }>
      }
    ).data
    for (const worker of workers) {
      workerInfo.set(worker.id, {
        photoUrl: worker.photoUrl,
        jobTitle: worker.position?.name ?? '—',
      })
    }
  }

  if (timesheets.length === 0) {
    return {
      data: {
        days: [],
        rows: [],
        availableWeeks: [],
        requisitionNumbers: [],
        hotelNames: [],
      },
    }
  }

  const availableWeeks = [...new Set(timesheets.map((sheet) => sheet.weekStart))].sort()
  const firstWeek = availableWeeks[0] as string
  const lastWeek = availableWeeks[availableWeeks.length - 1] as string
  const totalDays =
    Math.round(
      (new Date(`${lastWeek}T00:00:00Z`).getTime() - new Date(`${firstWeek}T00:00:00Z`).getTime()) /
        MS_PER_DAY,
    ) + 7
  const days = Array.from({ length: totalDays }, (_item, index) => addDaysIso(firstWeek, index))

  const details = await Promise.all(
    timesheets.map((sheet) => fetchWithBQ(`/timesheets/${sheet.id}`)),
  )

  /** Fusión por persona × requisición: una fila, todas sus semanas. */
  const rows = new Map<string, TimelineRow>()
  for (const [index, sheet] of timesheets.entries()) {
    const detailRes = details[index]
    if (!detailRes || detailRes.error) continue
    const detail = (detailRes.data as ApiEnvelope<TimesheetApi>).data
    const requisitionRef = requisitionRefOf(requisitionIndex, detail.requisitionId)
    const requisitionInfo = requisitionIndex.get(detail.requisitionId)

    const key = `${detail.worker.id}|${detail.requisitionId}`
    const row = rows.get(key) ?? {
      workerId: detail.worker.id,
      requisitionId: detail.requisitionId,
      workerName: detail.worker.fullName,
      jobTitle: workerInfo.get(detail.worker.id)?.jobTitle ?? '—',
      /* El hotel es el de LA REQUISICIÓN de la fila, no el de quien mira: con
         un rol multi-hotel, cada fila dice el suyo y el filtro sirve. */
      hotelName: requisitionInfo?.hotelName ?? fallbackHotel,
      hotelPhotoUrl: requisitionInfo?.hotelPhotoUrl ?? null,
      photoUrl: workerInfo.get(detail.worker.id)?.photoUrl ?? null,
      entries: [],
      byWeek: {},
    }
    row.entries.push(...(detail.days ?? []).map((day) => toEntry(day, requisitionRef)))
    row.byWeek[sheet.weekStart] = {
      timesheetId: sheet.id,
      weekStatus: detail.status,
      totalHours: Math.round(((detail.totals?.netMinutes ?? 0) / 60) * 100) / 100,
    }
    rows.set(key, row)
  }

  const allRows = [...rows.values()]
  const requisitionNumbers = [
    ...new Set(allRows.flatMap((row) => row.entries.map((entry) => entry.requisitionNumber ?? ''))),
  ].filter(Boolean)

  const visible = allRows.filter((row) => {
    if (filters.search && !row.workerName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }
    if (
      filters.requisitionNumber !== ANY_VALUE &&
      !row.entries.some((entry) => entry.requisitionNumber === filters.requisitionNumber)
    ) {
      return false
    }
    if (filters.hotelName !== ANY_VALUE && row.hotelName !== filters.hotelName) return false
    return true
  })

  return {
    data: {
      days,
      rows: visible,
      availableWeeks,
      requisitionNumbers,
      hotelNames: [...new Set(allRows.map((row) => row.hotelName))].filter((name) => name !== '—'),
    },
  }
}

/**
 * El agregado del MES de la semana elegida: cuántas jornadas, horas y estados
 * hay por fecha. Junta los timesheets cuyas semanas tocan el mes y suma sus
 * días — mismo contrato, otra densidad (la vista Mes).
 */
async function fetchMonth(
  fetchWithBQ: FetchWithBQ,
  filters: TimesheetFilters,
): Promise<{ data: TimesheetMonth } | { error: unknown }> {
  const [listRes, requisitionIndex] = await Promise.all([
    fetchWithBQ({
      url: '/timesheets',
      params: { ...(filters.status !== ANY_VALUE ? { status: filters.status } : {}) },
    }),
    fetchRequisitionIndex(fetchWithBQ),
  ])
  if (listRes.error) return { error: listRes.error }

  const timesheets = (listRes.data as ApiEnvelope<TimesheetApi[]>).data
  if (timesheets.length === 0) return { data: { month: '', days: [] } }

  const availableWeeks = [...new Set(timesheets.map((sheet) => sheet.weekStart))].sort()
  /** El mes de la semana es el de su JUEVES (ISO 8601): una semana partida
      entre dos meses pertenece al que tiene la mayoría de sus días. */
  const month = addDaysIso(resolveWeek(availableWeeks, filters.weekStart) as string, 3).slice(0, 7)
  const ofMonth = timesheets.filter(
    (sheet) => sheet.weekStart.slice(0, 7) === month || sheet.weekEnd.slice(0, 7) === month,
  )

  const details = await Promise.all(ofMonth.map((sheet) => fetchWithBQ(`/timesheets/${sheet.id}`)))

  const byDate = new Map<string, TimesheetMonthDay>()
  for (const detailRes of details) {
    if (detailRes.error) continue
    const detail = (detailRes.data as ApiEnvelope<TimesheetApi>).data
    if (
      filters.search &&
      !detail.worker.fullName.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      continue
    }
    const requisitionRef = requisitionRefOf(requisitionIndex, detail.requisitionId)
    if (filters.requisitionNumber !== ANY_VALUE && requisitionRef !== filters.requisitionNumber) {
      continue
    }

    for (const day of detail.days ?? []) {
      if (day.workDate.slice(0, 7) !== month) continue
      const aggregate = byDate.get(day.workDate) ?? {
        date: day.workDate,
        netHours: 0,
        people: 0,
        pending: 0,
        observed: 0,
        reviewed: 0,
        absences: 0,
      }
      aggregate.people += 1
      if (day.isAbsence) aggregate.absences += 1
      else aggregate.netHours += day.netMinutes / 60
      const status = dayStatus(day)
      if (status === 'PENDING') aggregate.pending += 1
      else if (status === 'OBSERVED') aggregate.observed += 1
      else aggregate.reviewed += 1
      byDate.set(day.workDate, aggregate)
    }
  }

  const days = [...byDate.values()]
    .map((day) => ({ ...day, netHours: Math.round(day.netHours * 100) / 100 }))
    .sort((first, second) => (first.date < second.date ? -1 : 1))

  return { data: { month, days } }
}

export const timesheetApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTimesheetWeek: build.query<TimesheetWeek, TimesheetFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchWeek(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    getTimesheetTimeline: build.query<TimesheetTimeline, TimesheetFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchTimeline(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    getTimesheetMonth: build.query<TimesheetMonth, TimesheetFilters>({
      queryFn: async (filters, _api, _extra, fetchWithBQ) => {
        const result = await fetchMonth(fetchWithBQ as FetchWithBQ, filters)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /**
     * El paso del Supervisor (D-09): resuelve el día con su nota. Aprobar no
     * está aquí — le da 403 a propósito; eso es del Manager de Área o el GM.
     */
    reviewTimesheetDay: build.mutation<unknown, ReviewDayRequest>({
      query: ({ dayId, note }) => ({
        url: `/timesheet-days/${dayId}/review`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /** El Supervisor manda la semana a revisión; el back la frena si quedan anomalías. */
    submitTimesheet: build.mutation<unknown, string>({
      query: (timesheetId) => ({ url: `/timesheets/${timesheetId}/submit`, method: 'POST' }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /** Aprobar es del Manager de Área (su depto) o General (D-09): al resto, 403. */
    approveTimesheet: build.mutation<unknown, string>({
      query: (timesheetId) => ({ url: `/timesheets/${timesheetId}/approve`, method: 'POST' }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /**
     * Marca manual: el DTO real pide el ASSIGNMENT, que el timesheet no trae —
     * se resuelve aquí buscando la asignación del colaborador en la requisición
     * de la fila (patrón D-28), y el motivo es obligatorio.
     */
    createManualPunch: build.mutation<unknown, ManualPunchRequest>({
      queryFn: async (request, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const assignmentsRes = await bq(`/requisitions/${request.requisitionId}/assignments`)
        if (assignmentsRes.error) return { error: assignmentsRes.error as never }

        const assignments = (
          assignmentsRes.data as ApiEnvelope<Array<{ id: string; worker: { id: string } }>>
        ).data
        const assignment = assignments.find((item) => item.worker.id === request.workerId)
        if (!assignment) {
          return {
            error: {
              status: 404,
              data: {
                error: {
                  code: 'ASSIGNMENT_NOT_FOUND',
                  message: 'El colaborador no tiene asignación en esta requisición',
                },
              },
            } as never,
          }
        }

        const punchRes = await bq({
          url: '/punches/manual',
          method: 'POST',
          body: {
            assignmentId: assignment.id,
            type: request.type,
            workDate: request.workDate,
            occurredAt: request.occurredAt,
            reason: request.reason,
          },
        })
        if (punchRes.error) return { error: punchRes.error as never }
        return { data: null }
      },
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),
  }),
})

export interface ManualPunchRequest {
  requisitionId: string
  workerId: string
  type: 'CLOCK_IN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'CLOCK_OUT'
  /** ISO sin hora: el día al que pertenece la marca. */
  workDate: string
  /** ISO completo: cuándo ocurrió de verdad, según quien la captura. */
  occurredAt: string
  reason: string
}

export const {
  useGetTimesheetWeekQuery,
  useGetTimesheetTimelineQuery,
  useGetTimesheetMonthQuery,
  useReviewTimesheetDayMutation,
  useSubmitTimesheetMutation,
  useApproveTimesheetMutation,
  useCreateManualPunchMutation,
} = timesheetApi
