import { msg } from '@lingui/core/macro'

import { baseApi } from '@/app/baseApi'
import { i18n } from '@/app/i18n'
import type { TimesheetWeekStatus } from '@/shared/constants/timesheetStatus'
import { todayIn } from '@/shared/lib/formatters'
import type {
  ApiEnvelope,
  RequisitionApi,
  TimesheetApi,
  TimesheetDayApi,
  TimesheetPunchApi,
} from '@/shared/types/apiContract.types'

/**
 * Timesheet del hotel en la app, sobre los MISMOS endpoints que el web
 * (`features/timesheet/api/timesheetApi.ts`): `GET /timesheets` (el API recorta
 * por hotel y departamento), su detalle con días y marcas, y las acciones
 * —revisar un día, enviar la semana, aprobarla y la marca manual—. Reparto de
 * D-09: el Supervisor revisa, captura y envía; el Manager de Área (su
 * departamento) o el General aprueban.
 */

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000

export type PunchType = 'CLOCK_IN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'CLOCK_OUT'

/** Completo · trabajando · incompleto · sin marcas: el resumen del día en un punto. */
export type DayPunchState = 'COMPLETE' | 'IN_PROGRESS' | 'INCOMPLETE' | 'NO_SHIFT'

export interface AppTimesheetDay {
  id: string
  date: string
  netHours: number
  overtimeHours: number
  isAbsence: boolean
  hasAnomaly: boolean
  reviewNote: string | null
  punchState: DayPunchState
  punches: Array<{
    id: string
    type: string
    serverAt: string
    insideGeofence: boolean | null
    isManual: boolean
    manualReason: string | null
  }>
}

export interface AppTimesheetRow {
  timesheetId: string
  requisitionId: string
  requisitionNumber: string
  workerId: string
  workerName: string
  weekStart: string
  weekEnd: string
  status: TimesheetWeekStatus
  totalHours: number
  overtimeHours: number
  /** Días con anomalía sin nota de revisión: lo que frena «Enviar». */
  pendingAnomalies: number
  timeZone: string | undefined
  /** La asignación que respalda las horas; sin ella activa no se capturan marcas. */
  assignment: TimesheetApi['assignment']
  days: AppTimesheetDay[]
}

export interface AppTimesheetWeek {
  weekStart: string | null
  availableWeeks: string[]
  rows: AppTimesheetRow[]
}

function hours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

function punchStateOf(day: TimesheetDayApi, timeZone: string | undefined): DayPunchState {
  const hasIn = day.punches.some((punch) => punch.type === 'CLOCK_IN')
  const hasOut = day.punches.some((punch) => punch.type === 'CLOCK_OUT')
  if (hasIn && hasOut) return 'COMPLETE'
  if (day.punches.length === 0) return 'NO_SHIFT'
  /* Hoy con solo entrada no es incompleto: la jornada sigue (en la zona del hotel). */
  return day.workDate === todayIn(timeZone) ? 'IN_PROGRESS' : 'INCOMPLETE'
}

function toDay(day: TimesheetDayApi, timeZone: string | undefined): AppTimesheetDay {
  return {
    id: day.id,
    date: day.workDate,
    netHours: day.isAbsence ? 0 : hours(day.netMinutes),
    overtimeHours: hours(day.overtimeMinutes),
    isAbsence: day.isAbsence,
    hasAnomaly: day.hasAnomaly,
    reviewNote: day.reviewNote,
    punchState: punchStateOf(day, timeZone),
    punches: day.punches.map((punch: TimesheetPunchApi) => ({
      id: punch.id,
      type: punch.type,
      serverAt: punch.serverAt,
      insideGeofence: punch.insideGeofence,
      isManual: punch.isManual,
      manualReason: punch.manualReason,
    })),
  }
}

/** Los 7 días de la semana, aunque el API solo traiga los que tienen algo. */
function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_item, index) =>
    new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + index * MS_PER_DAY)
      .toISOString()
      .slice(0, 10),
  )
}

function toRow(sheet: TimesheetApi, requisition: RequisitionApi | undefined): AppTimesheetRow {
  const timeZone = requisition?.hotel.timeZone
  const byDate = new Map((sheet.days ?? []).map((day) => [day.workDate, toDay(day, timeZone)]))
  const days = weekDays(sheet.weekStart).map(
    (date): AppTimesheetDay =>
      byDate.get(date) ?? {
        id: `empty-${date}`,
        date,
        netHours: 0,
        overtimeHours: 0,
        isAbsence: false,
        hasAnomaly: false,
        reviewNote: null,
        punchState: 'NO_SHIFT',
        punches: [],
      },
  )
  return {
    timesheetId: sheet.id,
    requisitionId: sheet.requisitionId,
    requisitionNumber: requisition?.number ?? `req ${sheet.requisitionId.slice(0, 8)}`,
    workerId: sheet.worker.id,
    workerName: sheet.worker.fullName,
    weekStart: sheet.weekStart,
    weekEnd: sheet.weekEnd,
    status: sheet.status as TimesheetWeekStatus,
    totalHours: hours(sheet.totals?.netMinutes ?? 0),
    overtimeHours: hours(sheet.totals?.overtimeMinutes ?? 0),
    pendingAnomalies: days.filter((day) => day.hasAnomaly && day.reviewNote === null).length,
    timeZone,
    assignment: sheet.assignment,
    days,
  }
}

/** Índice id → requisición (folio y zona horaria del hotel). Tolerante: sin él, folio recortado. */
async function requisitionIndex(bq: FetchWithBQ): Promise<Map<string, RequisitionApi>> {
  const res = await bq({ url: '/requisitions', params: { limit: 100 } })
  if (res.error) return new Map()
  return new Map((res.data as ApiEnvelope<RequisitionApi[]>).data.map((item) => [item.id, item]))
}

export const timesheetAppApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Una semana a la vez; sin `weekStart` válido, la más reciente que haya. */
    appTimesheetWeek: build.query<AppTimesheetWeek, string | null>({
      queryFn: async (requested, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const [listRes, index] = await Promise.all([bq('/timesheets'), requisitionIndex(bq)])
        if (listRes.error) return { error: listRes.error as never }
        const sheets = (listRes.data as ApiEnvelope<TimesheetApi[]>).data
        const availableWeeks = [...new Set(sheets.map((sheet) => sheet.weekStart))].sort()
        const weekStart =
          requested !== null && availableWeeks.includes(requested)
            ? requested
            : (availableWeeks[availableWeeks.length - 1] ?? null)
        if (weekStart === null) return { data: { weekStart, availableWeeks, rows: [] } }

        /* La lista viaja sin días: el detalle de cada semana, en paralelo (D-28). */
        const ofWeek = sheets.filter((sheet) => sheet.weekStart === weekStart)
        const details = await Promise.all(ofWeek.map((sheet) => bq(`/timesheets/${sheet.id}`)))
        const rows = details
          .filter((res) => !res.error)
          .map((res) => (res.data as ApiEnvelope<TimesheetApi>).data)
          .map((sheet) => toRow(sheet, index.get(sheet.requisitionId)))
          .sort((a, b) => a.workerName.localeCompare(b.workerName))
        return { data: { weekStart, availableWeeks, rows } }
      },
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    appTimesheet: build.query<AppTimesheetRow, string>({
      queryFn: async (timesheetId, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const res = await bq(`/timesheets/${timesheetId}`)
        if (res.error) return { error: res.error as never }
        const sheet = (res.data as ApiEnvelope<TimesheetApi>).data
        const requisitionRes = await bq(`/requisitions/${sheet.requisitionId}`)
        const requisition = requisitionRes.error
          ? undefined
          : (requisitionRes.data as ApiEnvelope<RequisitionApi>).data
        return { data: toRow(sheet, requisition) }
      },
      providesTags: (_res, _err, timesheetId) => [
        { type: 'Timesheet' as const, id: 'LIST' },
        { type: 'Timesheet' as const, id: timesheetId },
      ],
    }),

    /** El paso del Supervisor: resuelve el día con su nota. */
    appReviewTimesheetDay: build.mutation<unknown, { dayId: string; note: string }>({
      query: ({ dayId, note }) => ({
        url: `/timesheet-days/${dayId}/review`,
        method: 'POST',
        body: { note },
      }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /** El Supervisor manda la semana a aprobación; el API la frena si quedan anomalías. */
    appSubmitTimesheet: build.mutation<unknown, string>({
      query: (timesheetId) => ({ url: `/timesheets/${timesheetId}/submit`, method: 'POST' }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /** Aprobar: Manager de Área (su departamento) o General. */
    appApproveTimesheet: build.mutation<unknown, string>({
      query: (timesheetId) => ({ url: `/timesheets/${timesheetId}/approve`, method: 'POST' }),
      invalidatesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),

    /**
     * Marca manual: el DTO pide la ASIGNACIÓN, que el timesheet no trae; se
     * busca la del colaborador en la requisición, como en el web. Motivo
     * obligatorio.
     */
    appCreateManualPunch: build.mutation<
      null,
      {
        requisitionId: string
        workerId: string
        type: PunchType
        workDate: string
        occurredAt: string
        reason: string
      }
    >({
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
                  message: i18n._(msg`El colaborador no tiene asignación en esta requisición`),
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

export const {
  useAppTimesheetWeekQuery,
  useAppTimesheetQuery,
  useAppReviewTimesheetDayMutation,
  useAppSubmitTimesheetMutation,
  useAppApproveTimesheetMutation,
  useAppCreateManualPunchMutation,
} = timesheetAppApi
