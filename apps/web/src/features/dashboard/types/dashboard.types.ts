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
