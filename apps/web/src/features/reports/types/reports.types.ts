import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'

/**
 * Formas de Reportes · Ventas, compuestas del contrato real: `/team`,
 * `/prospects` (con cerrados), su historial y sus intentos (D-28).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

export interface ConversionByBd {
  id: string
  fullName: string
  open: number
  converted: number
  /** Convertidos sobre (abiertos + convertidos), 0–1. */
  rate: number
  /** Días promedio de abrir el ciclo a Naranja; `null` sin conversiones. */
  averageDays: number | null
}

export interface TimeInState {
  status: OnboardingStatus
  /** Días promedio que un ciclo pasa en ese estado; `null` sin datos. */
  averageDays: number | null
}

export interface AttemptsMatrix {
  /** Códigos de canal en el orden de las columnas. */
  channels: string[]
  /** Una fila por resultado, con el conteo por canal. */
  rows: Array<{ outcome: string; counts: number[] }>
}

export interface ExitReason {
  label: string
  count: number
}

export interface SalesReport {
  conversionByBd: ConversionByBd[]
  teamTotals: { open: number; converted: number; rate: number; averageDays: number | null }
  timeInState: TimeInState[]
  /** El estado con mayor promedio: dónde se atora el pipeline. */
  bottleneck: TimeInState | null
  attempts: AttemptsMatrix
  exitReasons: ExitReason[]
  /** Salidas a ramas en el periodo: total y por rama. */
  exits: { total: number; red: number; brown: number; black: number }
}
