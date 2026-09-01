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
  /// `photoUrl` es la URL de media de Places compuesta al leer (D-34): null si
  /// el hotel no tiene foto o si no hay llave.
  hotel: { id: string; name: string; photoUrl: string | null }
  /// Quién la pidió. `photoUrl` va firmada al leer, como en /team.
  createdBy: { id: string; fullName: string; photoUrl: string | null } | null
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
