/**
 * Formas de la Blacklist, adaptadas del contrato real (`coverage.blacklist_entry`,
 * `GET /blacklist`). La fila NUNCA se borra: se marca como levantada, con quién
 * y por qué — es el historial completo que exige la regla.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

/** De dónde salió el veto. Los tres valores del CHECK de la tabla. */
export const BLACKLIST_SOURCES = ['MANUAL', 'ABSENCES', 'DISPUTE'] as const

export type BlacklistSource = (typeof BLACKLIST_SOURCES)[number]

export const BLACKLIST_SOURCE_LABEL: Record<BlacklistSource, string> = {
  MANUAL: 'Manual',
  ABSENCES: 'Por ausencias',
  DISPUTE: 'Por disputa',
}

export interface BlacklistRow {
  id: string
  workerId: string
  workerName: string
  source: BlacklistSource
  reason: string
  /** `null` cuando el veto no es manual: la evidencia solo se exige en MANUAL. */
  evidencePath: string | null
  enteredByName: string
  occurredAt: string
  isActive: boolean
  liftedAt: string | null
  liftedByName: string | null
  liftReason: string | null
}

/** Ningún filtro puesto en esa columna. */
export const ANY_VALUE = 'ALL'

export interface BlacklistFilters {
  /** `ALL` o uno de los `BLACKLIST_SOURCES`. */
  source: string
  /** Vigentes por omisión: el historial completo se pide a propósito. */
  onlyActive: boolean
}

export const EMPTY_BLACKLIST_FILTERS: BlacklistFilters = {
  source: ANY_VALUE,
  onlyActive: true,
}

export interface LiftBlacklistRequest {
  workerId: string
  liftReason: string
}

/** Vetar es siempre MANUAL desde la pantalla: ABSENCES y DISPUTE los genera el sistema. */
export interface CreateBlacklistRequest {
  workerId: string
  reason: string
  /** Obligatoria en un veto manual (CHECK del DTO). */
  evidencePath: string
}
