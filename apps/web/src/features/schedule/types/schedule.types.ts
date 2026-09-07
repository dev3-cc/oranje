/**
 * Formas del Schedule semanal (vista demanda + cobertura del hotel),
 * compuestas de `/schedules` (+ entradas) y `/requisitions` (D-28).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

/** Una posición demandada: la fila del resumen de cobertura. */
export interface ScheduleDemandRow {
  positionId: string
  name: string
  /** `HH:mm` pedido en la requisición; `—` si no se capturó. */
  startTime: string
  quantity: number
  filled: number
  lineNumber: number
  requisitionNumber: string
}

/**
 * Una persona programada un día: sale de `operations.schedule_entry`. El
 * contrato aún no liga la entrada con una posición de la requisición —
 * `startTime`/`endTime` separados (en vez de un `shift` ya formateado) para
 * que el grid calcule su geometría sin volver a parsear un string.
 */
export interface ScheduleWorkerEntry {
  id: string
  workDate: string
  workerId: string
  workerName: string
  /** `HH:mm` del turno planeado, hora del hotel. */
  startTime: string
  endTime: string
}

export interface ScheduleWeek {
  hotelName: string
  /** Los siete días en ISO de la semana ENSEÑADA; vacío = sin schedule. */
  days: string[]
  demand: ScheduleDemandRow[]
  /** Programados reales por día, del schedule de la semana enseñada. */
  entries: ScheduleWorkerEntry[]
  totalSlots: number
  filledSlots: number
  /** El lunes de la semana enseñada; `''` cuando el hotel no tiene ninguna. */
  weekStart: string
  /** Los lunes con datos, ascendentes: por ellos caminan ‹ › y el mini-calendario. */
  availableWeeks: string[]
}

/** Ningún filtro puesto en esa columna — mismo criterio que Timesheet. */
export const ANY_VALUE = 'ALL'
