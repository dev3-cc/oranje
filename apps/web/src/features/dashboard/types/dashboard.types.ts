import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'

export interface DashboardMetrics {
  openProspects: number
  staleProspects: number
  conversionRate: number
  averageConversionDays: number
  activeClients: number
}

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
  scope: { zones: string[]; periodLabel: string }
  metrics: DashboardMetrics
  funnel: FunnelBucket[]
  staleProspects: StaleProspect[]
}

export interface StateCount {
  code: string
  name: string
  color: string
  count: number
}

export interface DashboardRequisition {
  id: string
  number: string
  hotelName: string
  state: { code: string; name: string; color: string }
  totalSlots: number
  filledSlots: number
}

export interface RecruitmentOverview {
  poolTotal: number
  poolAvailable: number
  poolPendingValidation: number
  poolByState: StateCount[]
  queueOpen: number
  queueInProgress: number
  queue: DashboardRequisition[]
}

export interface HotelOverview {
  openRequisitions: number
  draftRequisitions: number
  coveredRequisitions: number
  pendingTimesheets: number
  requisitions: DashboardRequisition[]
}

/** Series semanales de la persona, derivadas de sus prospectos (D-28). */
export interface MyActivity {
  weekLabels: string[]
  openedPerWeek: number[]
  convertedPerWeek: number[]
  totalOpen: number
  totalConverted: number
}

/** El avance de un BD a cargo, para la tarjeta «Tu equipo» del dashboard. */
export interface TeamMemberProgress {
  id: string
  fullName: string
  openProspects: number
  conversions: number
  /** Convertidos sobre terminados, 0–1. */
  conversionRate: number
}
