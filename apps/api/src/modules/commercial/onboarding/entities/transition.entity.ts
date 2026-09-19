export interface TransitionOptionEntity {
  toState: { code: string; color: string; name: string; isBranch: boolean }
  requiresReason: boolean
  requiresEvidence: boolean
}

export interface HistoryEntryEntity {
  id: string
  fromState: { code: string; name: string } | null
  toState: { code: string; name: string }
  reason: { code: string; name: string } | null
  user: { id: string; fullName: string }
  occurredAt: string
}
