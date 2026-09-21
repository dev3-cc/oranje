/**
 * Contrato de `apps/api/src/modules/observability/`, transcrito de sus
 * entities reales (D-28: el front compone contra el contrato verdadero).
 */

export interface StateDuration {
  code: string
  name: string
  transitions: number
  avgHours: number | null
}

export interface StateSnapshot {
  code: string
  name: string
  count: number
}

export interface SpanSummary {
  resolved: number
  pending: number
  avgHours: number | null
}

/** Promedio de vida completa (no la suma de los promedios por estado). */
export interface TotalDuration {
  entities: number
  avgTotalHours: number | null
}

export type StatusLightCode =
  | 'WORKER'
  | 'REQUISITION'
  | 'ONBOARDING'
  | 'POSITION_COVERAGE'
  | 'URGENCY'
  | 'DAY_REVIEW'
  | 'WEEK_APPROVAL'
  | 'QUALITY'
  | 'TIMESHEET_COMPLIANCE'

export interface StatusLightSummary {
  code: StatusLightCode
  label: string
  hasHistory: boolean
  states: StateDuration[] | StateSnapshot[] | null
  span?: SpanSummary
  total?: TotalDuration
  note: string
}

export interface Punch {
  id: string
  type: 'CLOCK_IN' | 'LUNCH_OUT' | 'LUNCH_IN' | 'CLOCK_OUT'
  serverAt: string
  insideGeofence: boolean | null
  isManual: boolean
  workerId: string
  workerFullName: string
  hotelId: string
  hotelName: string
  /** Inicio del turno programado ese día, si lo hay. */
  scheduledStart: string | null
  /** Solo para CLOCK_IN con turno ese día: positivo = tarde, negativo = antes. Sin tolerancia inventada. */
  lateMinutes: number | null
}

export type DepartmentCode =
  'RECRUITMENT' | 'HOTEL' | 'SALES' | 'INSPECTION' | 'ACCOUNTING' | 'QA' | 'CUSTOMER_SERVICE'

export interface DepartmentMetric {
  code: DepartmentCode
  name: string
  implemented: boolean
  counts: Array<{ label: string; count: number }>
  note: string
}
