/** Un renglón del cuadro: el puesto y sus dos tarifas. */
export interface ProposalRateEntity {
  id: string
  position: { id: string; code: string; name: string }
  payRate: string
  billRate: string
}

export interface ProposalEntity {
  id: string
  version: number
  title: string | null
  servicesNote: string | null
  /** Campos del machote aprobado de la propuesta (2026-10-19): todos opcionales. */
  propertyName: string | null
  preparedDate: string | null
  brandManagementCompany: string | null
  cityState: string | null
  contactName: string | null
  senderPhone: string | null
  senderEmail: string | null
  /** El cuadro de tarifas por puesto; vacío mientras el borrador no lo tenga. */
  rates: ProposalRateEntity[]
  /** @deprecated Tarifa global de las versiones anteriores al cuadro por puesto. */
  payRate: string | null
  /** @deprecated Tarifa global de las versiones anteriores al cuadro por puesto. */
  billRate: string | null
  isDraft: boolean
  sentBy: { id: string; fullName: string } | null
  sentAt: string | null
  createdAt: string
  updatedAt: string | null
}
