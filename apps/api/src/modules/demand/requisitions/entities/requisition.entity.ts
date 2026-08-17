export interface StatusRef {
  code: string
  color: string
  name: string
}

export interface PositionEntity {
  id: string
  lineNumber: number
  position: { id: string; code: string; name: string }
  hiringModality: { id: string; code: string; name: string }
  englishLevel: { id: string; code: string; name: string } | null
  department: { id: string; code: string; name: string }
  quantity: number
  startDate: string
  startTime: string | null
  notes: string | null
  coverage: StatusRef
  urgency: StatusRef | null
  filled: number
}

export interface RequisitionEntity {
  id: string
  number: string
  hotel: { id: string; name: string }
  state: StatusRef
  areaManagerUserId: string | null
  authorizedBy: string | null
  authorizedAt: string | null
  inspectorId: string | null
  positions: PositionEntity[]
  totalSlots: number
  filledSlots: number
  createdAt: string
  updatedAt: string | null
}
