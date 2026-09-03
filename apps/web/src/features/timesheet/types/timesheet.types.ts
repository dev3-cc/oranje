import type { PunchState, TimesheetStatus } from '@/shared/constants/timesheetStatus'

/**
 * Formas del Timesheet semanal, adaptadas del contrato real
 * (`GET /timesheets[/:id]` de `operations`).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

/** Una marca del ponche, para el modal de revisión. */
export interface TimesheetPunch {
  id: string
  /** `CLOCK_IN`, `LUNCH_OUT`, `LUNCH_IN`, `CLOCK_OUT`. */
  type: string
  /** `HH:mm` del reloj del SERVIDOR (D-08). */
  serverTime: string
  /** `HH:mm` del dispositivo; `null` si no viajó. */
  deviceTime: string | null
  /** `null` = la geocerca no se evaluó (marca manual). */
  insideGeofence: boolean | null
  isManual: boolean
  manualReason: string | null
}

export interface TimesheetEntry {
  /** El id del DÍA (`operations.timesheet_day`): contra él se revisa. */
  id: string
  /** ISO sin hora. Es la columna del día en la que cae. */
  date: string
  status: TimesheetStatus
  /** Horas NETAS (tras el lunch fijo de 30 min, D-21). `null` = ausencia. */
  hours: number | null
  /** `HH:mm` del servidor. `null` mientras falte la marca. */
  startTime: string | null
  endTime: string | null
  /**
   * Referencia de la requisición que cubrió el día. El contrato da su id,
   * no el folio: se enseña recortado hasta que la API lo exponga.
   */
  requisitionNumber: string | null
  punch: PunchState
  hasAnomaly: boolean
  isAbsence: boolean
  reviewNote: string | null
  punches: TimesheetPunch[]
}

export interface TimesheetRow {
  /** El id del TIMESHEET (semana × persona × requisición): contra él se envía/aprueba. */
  timesheetId: string
  /** La requisición del timesheet: con ella se resuelve el assignment del ponche manual. */
  requisitionId: string
  workerId: string
  workerName: string
  /** El contrato aún no expone el puesto: raya, no un dato inventado. */
  jobTitle: string
  hotelName: string
  /** Estado de la SEMANA: abierta, enviada o aprobada (D-09). */
  weekStatus: string
  /** Horas netas de la semana, sumadas por el backend (`totals`). */
  totalHours: number
  /** `null`: las horas contractuales aún no viajan en el contrato. */
  targetHours: number | null
  entries: TimesheetEntry[]
}

export interface TimesheetWeek {
  /** Los siete días, en orden, en ISO. El encabezado se arma con estos. */
  days: string[]
  rows: TimesheetRow[]
  /** Para armar los filtros sin deducirlos de las filas que quedaron visibles. */
  requisitionNumbers: string[]
  hotelNames: string[]
  /** El lunes de la semana enseñada; `''` cuando no llegó nada. */
  weekStart: string
  /** Los lunes con datos, ascendentes: por ellos caminan ‹ ›, «Hoy» y el tirador. */
  availableWeeks: string[]
}

/** Ningún filtro puesto en esa columna. */
export const ANY_VALUE = 'ALL'

export interface TimesheetFilters {
  search: string
  requisitionNumber: string
  /** Estado de la SEMANA (`OPEN | PENDING_APPROVAL | APPROVED`): va al servidor. */
  status: string
  hotelName: string
  /** Lunes ISO de la semana a enseñar; `ALL` = la más reciente con datos. */
  weekStart: string
}

export const EMPTY_TIMESHEET_FILTERS: TimesheetFilters = {
  search: '',
  requisitionNumber: ANY_VALUE,
  status: ANY_VALUE,
  hotelName: ANY_VALUE,
  weekStart: ANY_VALUE,
}

/** Identidad que acompaña a la Revisión del día: el hero del modal. */
export interface ReviewContext {
  workerPhotoUrl: string | null
  jobTitle: string | null
  hotelName: string | null
  hotelPhotoUrl: string | null
}

export interface ReviewDayRequest {
  dayId: string
  note: string
}

/**
 * Una fila de la CINTA continua: la misma persona (y requisición) a lo largo
 * de TODAS las semanas cargadas. Sus días forman una línea de tiempo sin
 * cortes — es lo que permite que las fechas vecinas entren en vivo al
 * arrastrar, sin esperar una recarga.
 */
export interface TimelineRow {
  workerId: string
  requisitionId: string
  workerName: string
  jobTitle: string
  hotelName: string
  /** Foto del hotel DE LA REQUISICIÓN de la fila (D-34); `null` honesto. */
  hotelPhotoUrl: string | null
  /** Foto del colaborador (de `/workers`, D-28); `null` honesto si no hay. */
  photoUrl: string | null
  /** Todos los días con registro, de todas las semanas. */
  entries: TimesheetEntry[]
  /** El resumen de cada semana (el timesheet es semana × persona × requisición). */
  byWeek: Record<string, { timesheetId: string; weekStatus: string; totalHours: number }>
}

export interface TimesheetTimeline {
  /** Días CONTINUOS, del lunes de la primera semana al domingo de la última. */
  days: string[]
  rows: TimelineRow[]
  availableWeeks: string[]
  requisitionNumbers: string[]
  hotelNames: string[]
}

/** Un día del mes con actividad: el agregado de las jornadas de esa fecha. */
export interface TimesheetMonthDay {
  date: string
  /** Horas netas sumadas del día; las ausencias no suman horas. */
  netHours: number
  /** Cuántas personas tuvieron jornada (o ausencia) ese día. */
  people: number
  pending: number
  observed: number
  reviewed: number
  absences: number
}

export interface TimesheetMonth {
  /** `YYYY-MM` del mes enseñado: el de la semana elegida. `''` sin datos. */
  month: string
  days: TimesheetMonthDay[]
}
