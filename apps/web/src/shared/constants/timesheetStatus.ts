import type { StatusLightToken } from '@oranje/ui'

/**
 * Estado de revisión del DÍA. Se DERIVA de `operations.timesheet_day`:
 * `has_anomaly` sin resolver → Observado; `review_note` escrita → Revisado;
 * lo demás → Pendiente. No es columna propia: es la lectura de esas dos.
 */
export const TIMESHEET_STATUSES = ['PENDING', 'OBSERVED', 'REVIEWED'] as const

export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number]

export const TIMESHEET_STATUS_LABEL: Record<TimesheetStatus, string> = {
  PENDING: 'Pendiente',
  OBSERVED: 'Observado',
  REVIEWED: 'Revisado',
}

export const TIMESHEET_STATUS_TOKEN: Record<TimesheetStatus, StatusLightToken> = {
  PENDING: 'st-azul-claro',
  OBSERVED: 'st-amarillo',
  REVIEWED: 'st-morado',
}

/**
 * Estado de las checadas del día. Es OTRA cosa que el indicador de arriba: uno
 * dice si la persona marcó entrada y salida; el otro, si alguien ya revisó lo
 * que marcó.
 */
/**
 * Estado de la SEMANA (`operations.timesheet.status`, `ck_timesheet_status`):
 * el ciclo revisar → enviar → aprobar de D-09. Es OTRA cosa que el estado del
 * día de arriba, que habla de la revisión de una jornada.
 */
export const TIMESHEET_WEEK_STATUSES = ['OPEN', 'PENDING_APPROVAL', 'APPROVED'] as const

export type TimesheetWeekStatus = (typeof TIMESHEET_WEEK_STATUSES)[number]

export const TIMESHEET_WEEK_STATUS_LABEL: Record<TimesheetWeekStatus, string> = {
  OPEN: 'Abierta',
  PENDING_APPROVAL: 'Enviada a aprobación',
  APPROVED: 'Aprobada',
}

/**
 * Set propio, sin pisar los colores que ya usa el estado del DÍA (azul
 * claro/amarillo/morado) — los dos semáforos conviven en la misma pantalla.
 */
export const TIMESHEET_WEEK_STATUS_TOKEN: Record<TimesheetWeekStatus, StatusLightToken> = {
  OPEN: 'st-gris',
  PENDING_APPROVAL: 'st-naranja',
  APPROVED: 'st-verde',
}

export const PUNCH_STATES = ['COMPLETE', 'INCOMPLETE', 'NO_SHIFT'] as const

export type PunchState = (typeof PUNCH_STATES)[number]

export const PUNCH_STATE_LABEL: Record<PunchState, string> = {
  COMPLETE: 'Checadas completas',
  INCOMPLETE: 'Faltan checadas',
  NO_SHIFT: 'Sin turno ese día',
}

/** Anchos de columna del control de zoom, en píxeles. */
export const COLUMN_WIDTHS = [90, 134, 180] as const

export type ColumnWidth = (typeof COLUMN_WIDTHS)[number]

export const DEFAULT_COLUMN_WIDTH: ColumnWidth = 134
