import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'

/**
 * Formas de Mi Equipo (BDC), compuestas de `/team` + `/prospects` (D-28).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

export interface TeamMemberCard {
  id: string
  fullName: string
  /** Nombres de las zonas asignadas; vacío = sin territorio repartido. */
  zoneNames: string[]
  /** Las zonas con su id: lo que la asignación de territorio edita. */
  zones: Array<{ id: string; name: string }>
  openProspects: number
  /** Naranjas cuyo ciclo convirtió dentro del trimestre en curso. */
  quarterConversions: number
  /** Convertidos sobre (abiertos + convertidos), 0–1. */
  conversionRate: number
  /** Días promedio de la apertura del ciclo a Naranja. `null` sin conversiones. */
  averageConversionDays: number | null
  /** Abiertos con 7+ días sin intento de contacto. */
  staleCount: number
  /** Ciclos abiertos por estado del semáforo, en orden del pipeline. */
  byState: Array<{ status: OnboardingStatus; count: number }>
  /** Los ciclos abiertos del BD, para la tabla del panel de detalle. */
  openCycles: TeamMemberCycle[]
}

export interface TeamMemberCycle {
  prospectId: string
  hotelName: string
  status: OnboardingStatus
  /** Días desde el último intento de contacto (o desde la apertura si no hay). */
  daysSinceAttempt: number
}

export interface TeamOverview {
  memberCount: number
  openProspects: number
  quarterConversions: number
  /** Días promedio a Naranja de TODO el equipo. `null` sin conversiones. */
  averageConversionDays: number | null
  members: TeamMemberCard[]
}
