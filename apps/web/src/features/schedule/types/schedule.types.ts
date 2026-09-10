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

/**
 * Alguien con asignación ACTIVA en una requisición con demanda viva de este
 * hotel — quien se puede programar. Sale de `/requisitions/:id/assignments`
 * de las requisiciones de `demand`; no lleva posición: el contrato no liga la
 * asignación con la posición de forma confiable (solo el ordinal del slot,
 * aproximado con varias posiciones — mismo hallazgo que `requisitionsApi`) y
 * esta pantalla decidió no inventar ese vínculo (ver doc de `SchedulePage`).
 */
export interface ScheduleAssignee {
  assignmentId: string
  workerId: string
  workerName: string
}

/** Lo que pide crear un turno: `POST /schedules/:id/entries`, con el schedule resuelto o creado antes. */
export interface CreateShiftRequest {
  hotelId: string
  workDate: string
  assignmentId: string
  startTime: string
  endTime: string
}

/**
 * La CINTA completa: todas las semanas del hotel de una vez, como el
 * `TimesheetTimeline` de la vista Días — navegar es mover la ventana sobre
 * `days`, no volver a pedir datos. La demanda no varía por semana (es la
 * cobertura viva del hotel, no un desglose por día), así que no se repite por
 * semana aquí.
 */
export interface ScheduleTimeline {
  hotelId: string
  hotelName: string
  /** Todos los días de TODAS las semanas cargadas, ascendente. */
  days: string[]
  demand: ScheduleDemandRow[]
  /** Programados de TODAS las semanas cargadas, sin filtrar por semana. */
  entries: ScheduleWorkerEntry[]
  totalSlots: number
  filledSlots: number
  /** Los lunes con schedule, ascendentes: por ellos caminan ‹ ›, Hoy y el mini-calendario. */
  availableWeeks: string[]
  /** A quién se le puede agregar un turno (Agregar turno, `schedule:update`). */
  assignees: ScheduleAssignee[]
}

/** Ningún filtro puesto en esa columna — mismo criterio que Timesheet. */
export const ANY_VALUE = 'ALL'
