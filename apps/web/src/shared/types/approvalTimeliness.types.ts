/**
 * KPI 4 · Aprobación oportuna de ponches. Forma de `GET /observability/approval-timeliness`
 * y de `GET /pending-approvals/timeliness` (la misma fuente de cálculo en el API).
 */
export type TimelinessLevel = 'GREEN' | 'YELLOW' | 'RED'

export interface TimelinessTotals {
  timesheets: { total: number; onTime: number; late: number; pending: number }
  punches: {
    total: number
    onTime: number
    /** `null` cuando el periodo no tiene ponches. */
    percentage: number | null
    level: TimelinessLevel | null
  }
  /** Promedio de días de atraso de las semanas no aprobadas a tiempo. */
  avgDaysLate: number | null
}

export interface TimelinessByHotel extends TimelinessTotals {
  hotelId: string
  hotelName: string
}

export interface TimelinessByManager extends TimelinessTotals {
  hotelId: string
  hotelName: string
  departmentId: string | null
  departmentName: string | null
  managers: Array<{ id: string; fullName: string }>
}

export interface ApprovalTimeliness {
  weeks: number
  thresholds: { green: number; yellow: number }
  overall: TimelinessTotals
  byHotel: TimelinessByHotel[]
  byManager: TimelinessByManager[]
}
