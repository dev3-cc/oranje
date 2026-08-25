import type { WorkerApi } from '@/shared/types/apiContract.types'

/**
 * Formas del apartado del Colaborador, transcritas del contrato REAL
 * (`me.controller.ts` y `tax-deadline.service.ts` del back).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

/**
 * El plazo de SSN/ITIN (Reglas del Colaborador): 3 días desde el alta.
 * Día 4 = NOTICE (aviso interceptor) · día 5 = SUSPENDED (acceso suspendido).
 * Lo que corre el plazo hoy es SUBIR el documento; la retención del 16% es
 * independiente y aplica mientras `has_tax_id` sea false (D-27).
 */
export interface TaxDeadlineApi {
  status: 'OK' | 'NOTICE' | 'SUSPENDED'
  /** Días desde el alta; el día 1 es el del alta. */
  day: number
  dueAt: string
  hasDocument: boolean
  isDocumentVerified: boolean
  taxRetentionApplies: boolean
}

/** `GET /workers/me`: mi expediente completo (misma entidad que /workers/:id) + el plazo. */
export type MyProfile = WorkerApi & { taxDeadline: TaxDeadlineApi }

/**
 * `PATCH /workers/me/signup` — Fases 2 y 3 (cambio del 2026-08-22): de la
 * Fase 2 solo queda el transporte; posición, modalidad, inglés y experiencia
 * las decide Oranje en la entrevista. Todos opcionales, al menos uno.
 */
export interface CompleteSignupRequest {
  transportType?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
  bloodType?: string
  medicalNotes?: string
}

/**
 * Un aviso CRUDO, como lo sirve `GET /notifications` (verificado contra
 * `notifications.service.ts` del back): `type` y `entity` van anidados.
 */
export interface NotificationApi {
  id: string
  type: { code: string; name: string; module: string }
  title: string
  body: string
  entity: { type: string; id: string } | null
  createdAt: string
  readAt: string | null
}

/** La lista es un board paginado; `meta.unread` es el contador del tab. */
export interface NotificationBoardApi {
  data: NotificationApi[]
  meta: { page: number; limit: number; total: number; totalPages: number; unread: number }
}

/** Un aviso mío, ya aplanado para la vista. */
export interface MyNotification {
  id: string
  typeCode: string
  title: string
  body: string
  entityType: string | null
  entityId: string | null
  createdAt: string
  /** `null` = no leída. */
  readAt: string | null
}

/** Lo que la vista consume: los avisos de la página + el contador real. */
export interface MyNotificationList {
  items: MyNotification[]
  unread: number
}

// ── Los enum del CHECK real viven en shared: también los usa el Expediente ──
export {
  BLOOD_LABEL,
  BLOOD_TYPES,
  EXPERIENCE_LABEL,
  EXPERIENCE_LEVELS,
  RELATIONSHIP_LABEL,
  RELATIONSHIPS,
  TRANSPORT_LABEL,
  TRANSPORT_TYPES,
} from '@/shared/constants/workerEnums'
