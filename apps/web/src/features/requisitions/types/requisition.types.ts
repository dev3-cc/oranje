import type { RequisitionStatus, UrgencyLevel } from '@/shared/constants/requisitionStatus'

export interface RequisitionCoverage {
  filled: number
  total: number
}

export interface RequisitionRow {
  id: string
  number: string
  hotelName: string
  department: string
  positions: number
  coverage: RequisitionCoverage
  urgency: UrgencyLevel
  status: RequisitionStatus
  authorizedAt: string | null
  inspectorName: string
  /** La foto del hotel (Places) y quién la pidió — llegan cuando el back los exponga. */
  hotelPhotoUrl: string | null
  creator: { name: string; photoUrl: string | null } | null
}

export interface RequisitionBoardMetrics {
  openCount: number
  openHotels: number
  awaitingAuthorization: number
  awaitingOver48h: number
  partialCoverage: number
  freeSlots: number
  urgentCount: number
  urgentRuleId: string
}

export interface RequisitionBoard {
  metrics: RequisitionBoardMetrics
  items: RequisitionRow[]
}

export const SLOT_STATUSES = ['occupied', 'free'] as const

export type SlotStatus = (typeof SLOT_STATUSES)[number]

export interface RequisitionSlot {
  id: string
  index: number
  status: SlotStatus
  assigneeName: string | null
  assignedAt: string | null
  offerChannel: string | null
}

export interface RequisitionPosition {
  id: string
  index: number
  name: string
  quantity: number
  startDate: string
  startTime: string
  english: string
  coverage: RequisitionCoverage
  urgency: UrgencyLevel
  modality: string
  slots: RequisitionSlot[]
}

export interface RequisitionTotals {
  positionCount: number
  slotCount: number
  occupiedCount: number
  coverage: number
}

export interface RequisitionStatusEvent {
  id: string
  fromStatus: RequisitionStatus | null
  toStatus: RequisitionStatus
  action: string
  byName: string
  at: string
}

export interface RequisitionDetail {
  id: string
  number: string
  hotelName: string
  department: string
  status: RequisitionStatus
  createdByName: string
  createdAt: string
  authorizedByName: string | null
  authorizedAt: string | null
  inspectorName: string
  totals: RequisitionTotals
  positions: RequisitionPosition[]
  history: RequisitionStatusEvent[]
}

export interface AuthorizationUrgencyPreview {
  startDate: string
  daysAhead: number
  urgency: UrgencyLevel
  positionCount: number
}

export interface AuthorizationRequest {
  id: string
  number: string
  hotelName: string
  department: string
  requestedByName: string
  status: RequisitionStatus
  positionCount: number
  slotCount: number
  startsInDays: number
  positions: RequisitionPosition[]
  urgencyPreview: AuthorizationUrgencyPreview
}

export interface AuthorizationQueue {
  items: AuthorizationRequest[]
  authorizerRole: string
  authorizerScope: string
}

export interface StatusChangeReason {
  id: string
  label: string
}

export interface ResolveAuthorizationPayload {
  requisitionId: string
}

export interface CatalogOption {
  id: string
  code: string
  name: string
}

export interface RequisitionHotelOption {
  id: string
  name: string
  zoneName: string
  photoUrl: string | null
}

export interface RequisitionFormOptions {
  hotels: RequisitionHotelOption[]
  departments: CatalogOption[]
  positions: CatalogOption[]
  modalities: CatalogOption[]
  englishLevels: CatalogOption[]
}

export interface CreateRequisitionPosition {
  catalogPositionId: string
  hiringModalityId: string
  hotelDepartmentId: string
  englishLevelId?: string
  quantity: number
  startDate: string
  startTime?: string
}

export interface CreateRequisitionRequest {
  hotelId: string
  positions: CreateRequisitionPosition[]
}
