/**
 * La Bolsa Self-Pick (RR-15): renglones de requisición con slots libres, que
 * cualquier reclutadora puede tomar — gana la primera que confirma y lo hace
 * cumplir el motor (`FOR UPDATE SKIP LOCKED`, D-02).
 */

/** Un renglón con slots libres, ya aplanado para la tarjeta de la bolsa. */
export interface SelfPickRow {
  requisitionId: string
  requisitionNumber: string
  requisitionState: string
  positionId: string
  lineNumber: number
  positionName: string
  positionCatalogId: string
  hotelName: string
  departmentName: string
  startDate: string
  startTime: string | null
  modalityName: string
  modalityId: string
  /** `null` = No requerido: el renglón no exige inglés. */
  englishName: string | null
  englishId: string | null
  quantity: number
  freeSlots: number
}

export interface SelfPickBoard {
  rows: SelfPickRow[]
  totalFreeSlots: number
  totalRequisitions: number
}

/** La pantalla de slots de UN renglón: cada unidad de `quantity` es un slot. */
export interface SlotRow {
  ordinal: number
  /** `null` = libre. */
  workerName: string | null
  assignmentType: string | null
}

export interface SlotBoard {
  requisitionId: string
  requisitionNumber: string
  requisitionState: { code: string; name: string }
  hotelName: string
  lineNumber: number
  positionName: string
  coverage: { code: string; name: string }
  slots: SlotRow[]
  freeSlots: number
  /** El siguiente slot a llenar; `null` si el renglón está completo. */
  nextFreeOrdinal: number | null
}

/** Lo que `POST /assignments` pide, con los nombres del DTO real. */
export interface CreateAssignmentRequest {
  positionId: string
  workerId: string
  type: 'FIXED' | 'TEMPORARY'
  startDate?: string
  endDate?: string
}

export const ASSIGNMENT_TYPE_LABEL: Record<string, string> = {
  FIXED: 'Fijo',
  TEMPORARY: 'Temporal',
}

/** Un colaborador elegible para el slot, en la forma mínima del picker. */
export interface AssignableWorker {
  id: string
  fullName: string
  zoneName: string
  stateCode: string
}
