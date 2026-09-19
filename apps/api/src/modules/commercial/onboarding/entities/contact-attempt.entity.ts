export interface ContactAttemptEntity {
  id: string
  attemptType: string
  outcome: string
  contact: { id: string; fullName: string; jobTitle: string | null } | null
  user: { id: string; fullName: string }
  occurredAt: string
  notes: string | null
}

export interface AttemptSummary {
  total: number
  byOutcome: Array<{ outcome: string; total: number }>
  lastAttemptAt: string | null
}
