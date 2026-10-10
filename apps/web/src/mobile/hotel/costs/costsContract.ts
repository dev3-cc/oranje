/**
 * El contrato de los endpoints de costos del hotel que va a construir el
 * backend (ver `apps/mobile/docs/COSTOS-HOTEL-API.md`). La app lo consume tal
 * cual; mientras el endpoint no exista (404), pinta datos de ejemplo.
 *
 * El costo es lo que el HOTEL le paga a Oranje: `billRate` × horas, y el
 * overtime con su multiplicador del contrato — el mismo cálculo que la
 * factura. El `payRate` y el margen NUNCA viajan aquí: son información interna
 * de Oranje (lo dice el propio esquema del API).
 *
 * Dinero como TEXTO decimal (`"1234.50"`), igual que el resto del API: un
 * `number` de JavaScript redondea centavos.
 */

/** Por qué un número no está completo. */
export type CostGap =
  /** El hotel no tiene un contrato ACTIVE: no hay tarifas contra qué calcular. */
  | 'NO_ACTIVE_CONTRACT'
  /** Una posición trabajada no tiene `contract_rate` en el contrato activo. */
  | 'POSITION_WITHOUT_RATE'
  /** Hay horas en semanas todavía no aprobadas: el monto puede cambiar. */
  | 'UNAPPROVED_HOURS'
  /** Hay días con anomalía sin revisar: sus horas pueden corregirse. */
  | 'UNREVIEWED_ANOMALIES'

export type CostStatus = 'COMPLETE' | 'INCOMPLETE'

/** `GET /hotel-costs/weeks?from=YYYY-MM-DD&to=YYYY-MM-DD` — una fila por semana del hotel. */
export interface HotelCostWeekApi {
  weekStart: string
  weekEnd: string
  /** La semana que corre hoy en la zona del hotel. */
  isCurrent: boolean
  regularMinutes: number
  overtimeMinutes: number
  /** Solo semanas APROBADAS: lo que irá a la factura. `null` si no hay con qué calcularlo. */
  approvedCost: string | null
  /** Todo lo ponchado (aprobado o no), con las tarifas que existan. `null` si nada tiene tarifa. */
  estimatedCost: string | null
  status: CostStatus
  gaps: CostGap[]
}

export interface HotelCostWeeksResponse {
  currency: 'USD'
  weeks: HotelCostWeekApi[]
}

/** `GET /hotel-costs/weeks/:weekStart/positions` — el desglose de una semana por posición. */
export interface HotelCostPositionApi {
  catalogPositionId: string
  positionName: string
  departmentName: string
  /** Personas distintas que trabajaron esa posición en la semana. */
  workers: number
  regularMinutes: number
  overtimeMinutes: number
  /** La tarifa del contrato para esa posición; `null` = el contrato no la tiene. */
  billRate: string | null
  overtimeMultiplier: string | null
  /** `null` cuando falta la tarifa: se enseñan las horas, no un costo inventado. */
  cost: string | null
  status: CostStatus
  gaps: CostGap[]
}

export interface HotelCostPositionsResponse {
  currency: 'USD'
  weekStart: string
  weekEnd: string
  positions: HotelCostPositionApi[]
}
