/**
 * Formas del Schedule semanal (vista demanda + cobertura del hotel),
 * compuestas de `/schedules` (+ entradas) y `/requisitions` (D-28).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

/** Una posición demandada: la fila del grid. */
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

/** Una persona programada un día: sale de `operations.schedule_entry`. */
export interface ScheduleWorkerEntry {
  id: string
  workDate: string
  workerName: string
  /** `HH:mm – HH:mm` del turno planeado. */
  shift: string
}

export interface ScheduleWeek {
  hotelName: string
  /** Los siete días en ISO; vacío = el hotel aún no tiene schedule. */
  days: string[]
  demand: ScheduleDemandRow[]
  /** Programados reales por día, del schedule del hotel. */
  entries: ScheduleWorkerEntry[]
  totalSlots: number
  filledSlots: number
}
