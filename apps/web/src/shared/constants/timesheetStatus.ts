import type { StatusLightToken } from '@oranje/ui'

/**
 * Indicador de Timesheet: en qué punto de la revisión está el día de alguien.
 *
 * ⚠ DERIVADO DE LA CAPTURA, NO DEL VAULT.
 *
 * §5 declara `packages/domain/src/semaforos/indicadorTimesheet.ts` pero no lo
 * transcribe, así que estos tres estados salen de la maqueta del Timesheet.
 * Igual que el de Colaborador: falta validarlo contra la nota y pasar por
 * `semaforo-guardian`. No se declaran transiciones — inventarlas sería peor que
 * no tenerlas.
 *
 * ⚠ Y aquí los nombres vuelven a estar en español, mientras el de Colaborador
 * llega en inglés. Es el mismo desacuerdo de idioma, ahora en dos semáforos
 * seguidos.
 */
export const TIMESHEET_STATUSES = ['PENDIENTE', 'OBSERVADO', 'REVISADO'] as const

export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number]

export const TIMESHEET_STATUS_LABEL: Record<TimesheetStatus, string> = {
  PENDIENTE: 'Pendiente',
  OBSERVADO: 'Observado',
  REVISADO: 'Revisado',
}

export const TIMESHEET_STATUS_TOKEN: Record<TimesheetStatus, StatusLightToken> = {
  PENDIENTE: 'st-azul-claro',
  OBSERVADO: 'st-amarillo',
  REVISADO: 'st-morado',
}

/**
 * Estado de las checadas del día. Es OTRA cosa que el indicador de arriba: uno
 * dice si la persona marcó entrada y salida; el otro, si alguien ya revisó lo
 * que marcó.
 */
export const PUNCH_STATES = ['COMPLETA', 'INCOMPLETA', 'SIN_TURNO'] as const

export type PunchState = (typeof PUNCH_STATES)[number]

export const PUNCH_STATE_LABEL: Record<PunchState, string> = {
  COMPLETA: 'Checadas completas',
  INCOMPLETA: 'Faltan checadas',
  SIN_TURNO: 'Sin turno ese día',
}

/** Anchos de columna del control de zoom, en píxeles. */
export const COLUMN_WIDTHS = [90, 134, 180] as const

export type ColumnWidth = (typeof COLUMN_WIDTHS)[number]

export const DEFAULT_COLUMN_WIDTH: ColumnWidth = 134
