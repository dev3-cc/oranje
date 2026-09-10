import type { MessageDescriptor } from '@lingui/core'

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
  /** La regla que define «urgente» (RR-H-05); en qué palabras se dice es cosa de la pantalla. */
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
  /** Por dónde se ofrece un slot libre; se traduce al pintar con `i18n._()` (D-36). */
  offerChannel: MessageDescriptor | null
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
  /** Qué pasó, en palabras; se traduce al pintar con `i18n._()` (D-36). */
  action: MessageDescriptor
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
  /** La foto del hotel (Places, D-34); `null` honesto si no hay. */
  hotelPhotoUrl: string | null
  totals: RequisitionTotals
  positions: RequisitionPosition[]
  history: RequisitionStatusEvent[]
}

/**
 * Quién está trabajando la requisición como equipo (RR-15, modelo
 * colaborativo): distinto de un slot ocupado — aquí puede haber varias
 * Reclutadoras cubriendo la MISMA requisición sin que eso llene ningún slot.
 */
export interface RequisitionParticipant {
  id: string
  userId: string
  fullName: string
  roleName: string
  joinedAt: string
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

/** Hasta dónde llega la firma (D-09): todo el hotel (Manager General) o solo su departamento. */
export type AuthorizerScope = 'HOTEL' | 'DEPARTMENT'

export interface AuthorizationQueue {
  items: AuthorizationRequest[]
  /** El total real del back — puede ser mayor a `items.length` si pasa del tope de paginación. */
  total: number
  authorizerRole: string
  authorizerScope: AuthorizerScope
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
  /** Solo posiciones: el departamento al que pertenece (`catalogs.position.hotel_department_id`). */
  hotelDepartmentId?: string
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
