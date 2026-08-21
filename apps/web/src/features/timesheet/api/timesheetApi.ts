import {
  ANY_VALUE,
  type ReviewDayRequest,
  type TimesheetEntry,
  type TimesheetFilters,
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
  const [listRes, meRes] = await Promise.all([
    fetchWithBQ({
      url: '/timesheets',
      params: { ...(filters.status !== ANY_VALUE ? { status: filters.status } : {}) },
    }),
    fetchWithBQ('/me'),
  ])
  if (listRes.error) return { error: listRes.error }
  if (meRes.error) return { error: meRes.error }

  const timesheets = (listRes.data as ApiEnvelope<TimesheetApi[]>).data
  const me = (meRes.data as ApiEnvelope<{ hotel: { name: string } | null }>).data
  const hotelName = me.hotel?.name ?? '—'

  if (timesheets.length === 0) {
    return { data: { days: [], rows: [], requisitionNumbers: [], hotelNames: [] } }
  }

  /** La pantalla es UNA semana: la más reciente entre lo que llegó. */
  const weekStart = [...timesheets]
    .map((sheet) => sheet.weekStart)
    .sort()
    .reverse()[0] as string
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
    /** El contrato da el id de la requisición, no su folio: se enseña recortado. */
    const requisitionRef = `req ${detail.requisitionId.slice(0, 8)}`

    rows.push({
      timesheetId: sheet.id,
      workerId: detail.worker.id,
      workerName: detail.worker.fullName,
      jobTitle: '—',
      hotelName,
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
      hotelNames: [hotelName].filter((name) => name !== '—'),
    },
  }
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
  }),
})

export const { useGetTimesheetWeekQuery, useReviewTimesheetDayMutation } = timesheetApi
