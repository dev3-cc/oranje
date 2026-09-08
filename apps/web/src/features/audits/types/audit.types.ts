/**
 * Auditoría de Presentación y Ambiente: dos auditorías semanales del
 * Supervisor de hotel — `supervision.audit`, ya construido y probado en el
 * back (183/183). Un registro SIN consecuencia: no toca ningún semáforo.
 */

/** Las dos auditorías; discriminan la forma de `Audit.worker`. */
export const AUDIT_TYPES = ['PERSONAL_PRESENTATION', 'ENVIRONMENT'] as const
export type AuditType = (typeof AUDIT_TYPES)[number]

/** CUMPLE | NO | N/A — N/A no cuenta ni pesa en el score. */
export const RESPONSE_VALUES = ['CUMPLE', 'NO', 'N/A'] as const
export type ResponseValue = (typeof RESPONSE_VALUES)[number]

export interface AuditResponse {
  checklistItemId: string
  category: string
  label: string
  value: ResponseValue
}

/** Forma de lista (`GET /audits`): sin las respuestas. */
export interface AuditHeader {
  id: string
  auditType: AuditType
  hotel: { id: string; name: string }
  /** Solo en PERSONAL_PRESENTATION; `null` en ENVIRONMENT. */
  worker: { id: string; fullName: string; photoUrl: string | null } | null
  supervisor: { id: string; fullName: string }
  /** `Decimal(5,2)` ya formateado por el back, p. ej. `"85.00"`. */
  score: string
  observations: string | null
  createdAt: string
  updatedAt: string | null
}

export interface Audit extends AuditHeader {
  responses: AuditResponse[]
}

/** Una fila de `GET /audits/last-per-worker`: para "tiempo sin auditar". */
export interface LastAuditPerWorker {
  workerId: string
  workerName: string
  photoUrl: string | null
  lastAuditedAt: string | null
}

/** Un reactivo del checklist, como lo sirve `GET /catalogs/audit-checklist-items` (lectura abierta). */
export interface ChecklistItem {
  id: string
  auditType: AuditType
  category: string
  label: string
  /** `Decimal(5,2)` como texto, p. ej. `"1.00"`. */
  weight: string
  ordinal: number
}

/** El mismo reactivo con `code`: solo lo ve/edita el Administrador (`catalogs:manage`). */
export interface AdminChecklistItem extends ChecklistItem {
  code: string
}

/** Lo que se contesta al crear o corregir. */
export interface AuditResponseInput {
  checklistItemId: string
  value: ResponseValue
}
