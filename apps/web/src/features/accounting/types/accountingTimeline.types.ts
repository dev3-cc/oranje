// eslint-disable-next-line no-restricted-imports
import type {
  TimesheetAssignment,
  TimesheetEntry,
} from '@/features/timesheet/types/timesheet.types'

/**
 * La cinta de días de Contabilidad: la misma FORMA que `TimelineRow` del
 * staff (persona × requisición, días en una sola línea de tiempo), más lo
 * que el staff no necesita — la vista previa de pago por semana. Es un tipo
 * propio, no el de `timesheet/`, para no acoplar un cambio de Contabilidad a
 * la pantalla que ya usan Supervisor/Manager/Manager de QA (Hugo, 2026-10-08).
 */
export interface AccountingTimelineWeek {
  timesheetId: string
  weekStatus: string
  regularMinutes: number
  overtimeMinutes: number
  payRate: string | null
  overtimeMultiplier: number | null
  subtotal: string | null
  isOverridden: boolean
  overrideReason: string | null
  /**
   * `true` cuando la tarifa viene de `personal.worker_rate` del colaborador y
   * no del contrato del hotel — se muestra como dato, nunca cambia el
   * subtotal (Hugo, 2026-10-08: lo que SÍ existe hoy es el rate interno llano;
   * el concepto extra tipo «Uber» vive en el catálogo `PayConcept` pero no
   * tiene todavía ni endpoint de alta ni pantalla — no se puede mostrar lo
   * que nadie puede capturar).
   */
  isInternalRate: boolean
}

export interface AccountingTimelineRow {
  workerId: string
  requisitionId: string
  assignment?: TimesheetAssignment | null | undefined
  workerName: string
  hotelName: string
  requisitionFolio: string
  entries: TimesheetEntry[]
  byWeek: Record<string, AccountingTimelineWeek>
}

export interface AccountingTimesheetTimeline {
  /** Días CONTINUOS, del lunes de la primera semana al domingo de la última. */
  days: string[]
  rows: AccountingTimelineRow[]
  availableWeeks: string[]
}
