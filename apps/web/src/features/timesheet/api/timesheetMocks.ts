import type { TimesheetEntry, TimesheetRow, TimesheetWeek } from '../types/timesheet.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures del Timesheet semanal. ANDAMIO TEMPORAL.
 *
 * La semana es la de la captura: viernes 31 de julio a jueves 6 de agosto de
 * 2026. El encabezado de la pantalla se arma con estas fechas y no con un texto
 * aparte, así que columnas y título no pueden discrepar.
 */
const DAYS = [
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
  '2026-08-03',
  '2026-08-04',
  '2026-08-05',
  '2026-08-06',
]

const REQ = 'SR26-104'

function entry(partial: Omit<TimesheetEntry, 'id'>): TimesheetEntry {
  return { id: `tse-${partial.date}-${String(partial.hours ?? 'x')}`, ...partial }
}

const ALEJANDRO: TimesheetEntry[] = [
  entry({
    date: '2026-07-31',
    status: 'REVISADO',
    hours: 8,
    startTime: '08:00',
    endTime: '16:00',
    requisitionNumber: REQ,
    punch: 'COMPLETA',
    isPaid: true,
  }),
  entry({
    date: '2026-08-01',
    status: 'OBSERVADO',
    hours: 1,
    startTime: '08:00',
    endTime: '09:00',
    requisitionNumber: REQ,
    punch: 'COMPLETA',
    isPaid: true,
  }),
  entry({
    date: '2026-08-02',
    status: 'OBSERVADO',
    hours: 8,
    startTime: '08:00',
    endTime: '16:00',
    requisitionNumber: REQ,
    punch: 'COMPLETA',
    isPaid: true,
  }),
  entry({
    date: '2026-08-03',
    status: 'OBSERVADO',
    hours: 8,
    startTime: '08:00',
    endTime: '16:00',
    requisitionNumber: REQ,
    punch: 'COMPLETA',
    isPaid: true,
  }),
  entry({
    date: '2026-08-04',
    status: 'OBSERVADO',
    hours: 8,
    startTime: '08:00',
    endTime: '16:00',
    requisitionNumber: REQ,
    punch: 'COMPLETA',
    isPaid: true,
  }),
  entry({
    // Turno que cruza la medianoche: entra el 5 y sale el 6. Las horas todavía
    // no se calculan porque el día no ha cerrado.
    date: '2026-08-05',
    status: 'PENDIENTE',
    hours: null,
    startTime: '17:11',
    endTime: '03:40',
    requisitionNumber: REQ,
    punch: 'COMPLETA',
    isPaid: false,
  }),
  entry({
    date: '2026-08-06',
    status: 'PENDIENTE',
    hours: 7.1,
    startTime: '01:58',
    endTime: '09:03',
    requisitionNumber: null,
    punch: 'COMPLETA',
    isPaid: false,
  }),
]

const ROWS: TimesheetRow[] = [
  {
    workerId: 'wrk-alejandro',
    workerName: 'Alejandro Ruiz',
    jobTitle: 'Test Cargo',
    hotelName: 'Hotel Puerto Real',
    totalHours: 33,
    targetHours: 40,
    unpaidCount: 1,
    withoutRequisitionCount: 1,
    entries: ALEJANDRO,
  },
  {
    workerId: 'wrk-camila',
    workerName: 'Camila Gomez',
    jobTitle: 'Test Cargo',
    hotelName: 'Grand Costa Nube',
    totalHours: 0,
    targetHours: 40,
    unpaidCount: 1,
    withoutRequisitionCount: 1,
    entries: [
      entry({
        date: '2026-08-01',
        status: 'PENDIENTE',
        hours: null,
        startTime: null,
        endTime: null,
        requisitionNumber: null,
        punch: 'SIN_TURNO',
        isPaid: false,
      }),
    ],
  },
  {
    workerId: 'wrk-mateo',
    workerName: 'Mateo Hernandez',
    jobTitle: 'Test Cargo',
    hotelName: 'Hotel Mirador',
    totalHours: 8,
    targetHours: 40,
    unpaidCount: 1,
    withoutRequisitionCount: 1,
    entries: [
      entry({
        date: '2026-08-01',
        status: 'OBSERVADO',
        hours: 8,
        startTime: '08:00',
        endTime: '16:00',
        requisitionNumber: null,
        punch: 'INCOMPLETA',
        isPaid: false,
      }),
    ],
  },
  {
    workerId: 'wrk-sofia',
    workerName: 'Sofia Garcia',
    jobTitle: 'Test Cargo',
    hotelName: 'Hotel Puerto Real',
    totalHours: 0,
    targetHours: 40,
    unpaidCount: 0,
    withoutRequisitionCount: 1,
    entries: [
      entry({
        date: '2026-08-01',
        status: 'PENDIENTE',
        hours: null,
        startTime: null,
        endTime: null,
        requisitionNumber: null,
        punch: 'SIN_TURNO',
        isPaid: false,
      }),
    ],
  },
]

const REQUISITION_NUMBERS = [REQ, 'SR26-098', 'SR26-112']
const HOTEL_NAMES = ['Hotel Puerto Real', 'Grand Costa Nube', 'Hotel Mirador']

function matches(row: TimesheetRow, params: URLSearchParams): boolean {
  const search = params.get('search') ?? ''
  const requisition = params.get('requisition') ?? 'ALL'
  const status = params.get('status') ?? 'ALL'
  const hotel = params.get('hotel') ?? 'ALL'

  if (hotel !== 'ALL' && row.hotelName !== hotel) return false
  if (search !== '' && !row.workerName.toLocaleLowerCase().includes(search.toLocaleLowerCase())) {
    return false
  }

  // Por requisición y por estado se filtra la FILA: si a alguien no le queda
  // ningún día que cumpla, no tiene por qué ocupar un renglón vacío.
  if (requisition !== 'ALL') {
    if (!row.entries.some((item) => item.requisitionNumber === requisition)) return false
  }
  if (status !== 'ALL') {
    if (!row.entries.some((item) => item.status === status)) return false
  }

  return true
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/timesheets/week',
    resolve: ({ search }): TimesheetWeek => ({
      days: DAYS,
      rows: ROWS.filter((row) => matches(row, search)),
      requisitionNumbers: REQUISITION_NUMBERS,
      hotelNames: HOTEL_NAMES,
    }),
  },
]

let areRoutesRegistered = false

export function registerTimesheetMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
