export interface ProspectEntity {
  id: string
  hotel: { id: string; name: string; zone: { id: string; code: string; name: string } }
  owner: { id: string; fullName: string }
  state: { code: string; color: string; name: string; isBranch: boolean; displayOrder: number }
  stateSince: string
  needDescription: string | null
  openedAt: string
  closedAt: string | null
  attemptCount: number
  lastAttempt: { occurredAt: string; attemptType: string; outcome: string } | null
  lastProposal: { version: number; isDraft: boolean; sentAt: string | null } | null
  isOpen: boolean
}
