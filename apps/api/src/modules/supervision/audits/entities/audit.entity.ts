export interface AuditResponseEntity {
  checklistItemId: string
  category: string
  label: string
  value: string
}

/// Forma de lista (`GET /audits`): sin las respuestas — eso es del detalle.
export interface AuditHeaderEntity {
  id: string
  auditType: string
  hotel: { id: string; name: string }
  worker: { id: string; fullName: string; photoUrl: string | null } | null
  supervisor: { id: string; fullName: string }
  /// `Decimal(5,2)` serializado con `.toFixed(2)`, como `payRate`/`billRate`.
  score: string
  observations: string | null
  createdAt: string
  updatedAt: string | null
}

export interface AuditEntity extends AuditHeaderEntity {
  responses: AuditResponseEntity[]
}

/// Una fila de `GET /audits/last-per-worker`.
export interface LastAuditPerWorker {
  workerId: string
  workerName: string
  photoUrl: string | null
  lastAuditedAt: string | null
}
