import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'

/**
 * Formas de respuesta del dashboard del rol.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5), hoy fuera del
 * alcance acordado.
 *
 * Los números llegan crudos: la tasa como fracción y los días como entero. Dar
 * formato —el `%`, la `d`— es cosa de la UI, no del backend.
 */

export interface DashboardMetrics {
  openProspects: number
  /** De los abiertos, cuántos llevan 7+ días sin intento de contacto. */
  staleProspects: number
  /** Fracción entre 0 y 1: Naranja sobre ciclos cerrados. */
  conversionRate: number
  /** Días promedio de Gris a Naranja. */
  averageConversionDays: number
  activeClients: number
}

/** Un peldaño del embudo: cuántos prospectos hay en ese estado del semáforo. */
export interface FunnelBucket {
  status: OnboardingStatus
  count: number
}

export interface StaleProspect {
  prospectId: string
  hotelName: string
  daysWithoutAttempt: number
  status: OnboardingStatus
}

export interface DashboardOverview {
  owner: { name: string; roleLabel: string }
  /** A qué territorio y periodo se refieren las cifras. */
  scope: { zones: string[]; periodLabel: string }
  metrics: DashboardMetrics
  funnel: FunnelBucket[]
  staleProspects: StaleProspect[]
}
