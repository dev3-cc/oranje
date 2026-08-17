export interface ProposalEntity {
  id: string
  version: number
  servicesNote: string | null
  payRate: string | null
  billRate: string | null
  isDraft: boolean
  sentBy: { id: string; fullName: string } | null
  sentAt: string | null
  createdAt: string
  updatedAt: string | null
}
