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
  /** Horas NETAS — ya con el lunch restado si el hotel no lo paga (D-33,
      2026-10-14: antes era fijo 30 min para todos, D-21 quedó superada).
      `null` = ausencia. */
  hours: number | null
  /** Minutos de lunch restados ESE día; 0 si el hotel lo paga o si no llegó
      a las 6.5 h que lo activan. Para mostrar el descuento, no solo el neto
      (Hugo, 2026-10-15: "pon -media hora en el timesheet"). */
  lunchDeductionMinutes: number
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
  /** Turno nocturno emparejado con el día siguiente/anterior (2026-10-12):
      exactamente uno puede ser `true`, nunca los dos. */
  continuesNextDay: boolean
  continuesFromPreviousDay: boolean
  isAbsence: boolean
  reviewNote: string | null
  /** Con qué se marcó un día sin ponches (Descanso, OFF…); `null` = sin marcar. */
  dayStatus: { code: string; name: string } | null
  punches: TimesheetPunch[]
}

/**
 * La asignación que respalda las horas de una fila. `ACTIVE` admite marcas;
 * `CLOSED`/`CANCELLED` son historia (se aprueban y pagan, pero ya no se
 * captura). `null` = no hay ninguna; `undefined` = el API no lo dijo, y
 * entonces no se bloquea nada.
 */
export interface TimesheetAssignment {
  status: 'ACTIVE' | 'CLOSED' | 'CANCELLED'
  /** Último día inclusivo de la vigencia; `null` en una asignación fija. */
  endsOn: string | null
}

/**
 * Lo que se le pagaría HOY a esta hoja, en vivo (D-10: 40 h por requisición).
 * Solo viaja con `timesheet:read_all_hotels` (Contabilidad, el Observador).
 * `subtotal` en `null` cuando no hay contrato ni tarifa interna que
 * resolver — nunca se inventa un pago (Hugo, 2026-10-14: "qué pasa cuando
 * no tenemos contrato, deberíamos mostrar que el contrato no está listo").
 */
export interface TimesheetPayPreview {
  regularMinutes: number
  overtimeMinutes: number
  payRate: string | null
  isInternalRate: boolean
  overtimeMultiplier: number | null
  /** Bruto: horas + reembolsos YA incluidos (Hugo, 2026-10-09: ajustes/gastos). */
  subtotal: string | null
  /** Descuentos YA incluidos (gastos que Oranje cubrió y le descuenta). */
  deductionAmount: string
  /** `subtotal - deductionAmount`; `null` cuando `subtotal` también lo es. */
  netAmount: string | null
  isOverridden: boolean
  overrideReason: string | null
  /** Lo que el hotel paga a Oranje por esta hoja — SIEMPRE del contrato
      (Hugo, 2026-10-14: "pay rate y bill, lado a lado"). `null` sin
      contrato ni tarifa para esa posición. */
  billRate: string | null
  billSubtotal: string | null
  /** Cuándo se tocó por última vez el contrato que resolvió la tarifa de
      arriba; `null` sin contrato o si nunca se editó. Comparado contra
      `approvedAt` de la hoja: si el contrato cambió DESPUÉS de aprobarse la
      semana, lo que se ve aquí ya no es lo que se aprobó (Hugo, 2026-10-16). */
  contractUpdatedAt: string | null
}

export interface TimesheetRow {
  /** El id del TIMESHEET (semana × persona × requisición): contra él se envía/aprueba. */
  timesheetId: string
  /** La requisición del timesheet: con ella se resuelve el assignment del ponche manual. */
  requisitionId: string
  assignment?: TimesheetAssignment | null | undefined
  workerId: string
  workerName: string
  /** El contrato aún no expone el puesto: raya, no un dato inventado. */
  jobTitle: string
  /** Foto del colaborador (de `/workers`, D-28); `null` honesto si no hay. */
  photoUrl: string | null
  hotelName: string
  /** `undefined`/`null` cuando el listado no trajo el hotel (fila sintética,
      sin timesheet real). Para el interruptor de lonche (Hugo, 2026-10-14). */
  hotelId?: string | null | undefined
  /** Estado de la SEMANA: abierta, enviada o aprobada (D-09). */
  weekStatus: string
  /** Horas netas de la semana, sumadas por el backend (`totals`). */
  totalHours: number
  /** `null`: las horas contractuales aún no viajan en el contrato. */
  targetHours: number | null
  /** Horas extra REALES de la semana (D-10: corte de 40 h por requisición,
      ya calculado por el servidor en `totals.overtimeMinutes`) — no se
      deriva de `targetHours`, que no existe todavía. `null` solo cuando el
      detalle no trajo `totals` (p. ej. en la cinta de Días). */
  overtimeHours: number | null
  entries: TimesheetEntry[]
  /** `undefined` sin acceso de Contabilidad al pago; `null` el back no lo mandó. */
  payPreview?: TimesheetPayPreview | null | undefined
  /** Cuándo el hotel/Manager aprobó la semana; `null` si no se ha aprobado
      o es una fila virtual sin timesheet real. */
  approvedAt: string | null
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
  /**
   * El periodo a revisar, `AAAA-MM-DD` o vacío en cada extremo (Hugo,
   * 2026-10-05). Acota la lista de semanas de la que salen LAS TRES vistas,
   * así que la navegación con flechas queda dentro del rango sola. Un solo
   * extremo ya acota: «desde el 1» es una pregunta legítima.
   */
  from: string
  to: string
}

export const EMPTY_TIMESHEET_FILTERS: TimesheetFilters = {
  search: '',
  requisitionNumber: ANY_VALUE,
  status: ANY_VALUE,
  hotelName: ANY_VALUE,
  weekStart: ANY_VALUE,
  from: '',
  to: '',
}

/** Identidad que acompaña a la Revisión del día: el hero del modal. */
export interface ReviewContext {
  workerPhotoUrl: string | null
  jobTitle: string | null
  hotelName: string | null
  hotelPhotoUrl: string | null
}

/**
 * Con qué abrir Marca manual. Lleva `entries` (no solo la identidad) para
 * que el diálogo sepa, del día que se elija ahí dentro, qué ya está
 * marcado — y proponga la marca que sigue en vez de asumir siempre Entrada
 * (Hugo, 2026-10-10).
 */
export type ManualPunchTarget = Pick<
  TimesheetRow,
  'requisitionId' | 'workerId' | 'workerName' | 'entries'
>

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
  assignment?: TimesheetAssignment | null | undefined
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
