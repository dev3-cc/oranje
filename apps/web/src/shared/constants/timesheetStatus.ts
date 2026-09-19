import { msg } from '@lingui/core/macro'
import type { StatusLightToken } from '@oranje/ui'

import { labelMap } from '@/shared/lib/i18nLabels'

/**
 * Estado de revisión del DÍA. Se DERIVA de `operations.timesheet_day`:
 * `has_anomaly` sin resolver → Observado; `review_note` escrita → Revisado;
 * lo demás → Pendiente. No es columna propia: es la lectura de esas dos.
 */
export const TIMESHEET_STATUSES = ['PENDING', 'OBSERVED', 'REVIEWED'] as const

export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number]

const TIMESHEET_STATUS_MESSAGE = {
  PENDING: msg`Pendiente`,
  OBSERVED: msg`Observado`,
  REVIEWED: msg`Revisado`,
}

export const TIMESHEET_STATUS_LABEL: Record<TimesheetStatus, string> =
  labelMap(TIMESHEET_STATUS_MESSAGE)

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

const TIMESHEET_WEEK_STATUS_MESSAGE = {
  OPEN: msg`Abierta`,
  PENDING_APPROVAL: msg`Enviada a aprobación`,
  APPROVED: msg`Aprobada`,
}

export const TIMESHEET_WEEK_STATUS_LABEL: Record<TimesheetWeekStatus, string> = labelMap(
  TIMESHEET_WEEK_STATUS_MESSAGE,
)

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

const PUNCH_STATE_MESSAGE = {
  COMPLETE: msg`Checadas completas`,
  INCOMPLETE: msg`Faltan checadas`,
  /* NO "Sin turno": el front solo sabe que no hay marcas ese día (0 punches),
     no si había turno programado — eso vive en el Schedule y hoy no se
     cruza contra el Timesheet. Afirmar "sin turno" sería el mismo error que
     ya se corrigió con `isAbsence`: nombrar una causa que nunca se verificó. */
  NO_SHIFT: msg`Sin marcas ese día`,
}

export const PUNCH_STATE_LABEL: Record<PunchState, string> = labelMap(PUNCH_STATE_MESSAGE)

/** Anchos de columna del control de zoom, en píxeles. */
export const COLUMN_WIDTHS = [90, 134, 180] as const

export type ColumnWidth = (typeof COLUMN_WIDTHS)[number]

export const DEFAULT_COLUMN_WIDTH: ColumnWidth = 134
