import type { StatusLightToken } from '@oranje/ui'

/**
 * Indicador de Timesheet: en qué punto de la revisión está el día de alguien.
 *
 * ⚠ DERIVADO DE LA CAPTURA, NO DEL VAULT.
 *
 * Estructura de Proyecto §6 declara `packages/domain/src/statusLights/timesheetIndicator.ts` pero no lo
 * transcribe, así que estos tres estados salen de la maqueta del Timesheet.
 * Igual que el de Colaborador: falta validarlo contra la nota y pasar por
 * `semaforo-guardian`. No se declaran transiciones — inventarlas sería peor que
 * no tenerlas.
 *
 * ⚠ Estos estados son POR DÍA y no son los de la base: `operations.timesheet`
 * lleva un `status` POR SEMANA con `OPEN | PENDING_APPROVAL | APPROVED`
 * (`ck_timesheet_status`). Cuando exista el endpoint habrá que decidir cómo se
 * derivan unos de otros; mientras, aquí solo se cumple D-11 (códigos en inglés).
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
