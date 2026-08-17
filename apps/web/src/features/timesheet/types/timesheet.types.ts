import type { PunchState, TimesheetStatus } from '@/shared/constants/timesheetStatus'

/**
 * Formas de respuesta del Timesheet semanal.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

export interface TimesheetEntry {
  id: string
  /** ISO sin hora. Es la columna del día en la que cae. */
  date: string
  status: TimesheetStatus
  /** `null` mientras no hay horas registradas: no es lo mismo que cero. */
  hours: number | null
  /** `HH:mm` en la zona horaria DEL HOTEL, no la del navegador. */
  startTime: string | null
  endTime: string | null
  /** Folio de la requisición que cubrió ese día. `null` = sin requisición. */
  requisitionNumber: string | null
  punch: PunchState
  /** Si ya se pagó ese día. Lo que no está pagado es lo que cuenta el chip. */
  isPaid: boolean
}

export interface TimesheetRow {
  workerId: string
  workerName: string
  jobTitle: string
  hotelName: string
  /**
   * Horas de la semana y la meta. Las manda el BACKEND sumadas: la fila puede
   * traer solo los días que caben en la ventana y el total habla de la semana.
   */
  totalHours: number
  targetHours: number
  /** Cuántos días de esta semana están sin pagar. */
  unpaidCount: number
  /** Cuántos días se trabajaron sin requisición asignada. */
  withoutRequisitionCount: number
  entries: TimesheetEntry[]
}

export interface TimesheetWeek {
  /** Los siete días, en orden, en ISO. El encabezado se arma con estos. */
  days: string[]
  rows: TimesheetRow[]
  /** Para armar los filtros sin deducirlos de las filas que quedaron visibles. */
  requisitionNumbers: string[]
  hotelNames: string[]
}

/** Ningún filtro puesto en esa columna. */
export const ANY_VALUE = 'ALL'

export interface TimesheetFilters {
  search: string
  requisitionNumber: string
  status: string
  hotelName: string
}

export const EMPTY_TIMESHEET_FILTERS: TimesheetFilters = {
  search: '',
  requisitionNumber: ANY_VALUE,
  status: ANY_VALUE,
  hotelName: ANY_VALUE,
}
