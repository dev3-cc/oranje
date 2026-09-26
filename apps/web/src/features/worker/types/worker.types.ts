import type { WorkerApi } from '@/shared/types/apiContract.types'

/**
 * Formas del apartado del Colaborador, transcritas del contrato REAL
 * (`me.controller.ts` y `tax-deadline.service.ts` del back).
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

/**
 * El plazo de SSN/ITIN (Reglas del Colaborador): 3 días desde la PRIMERA
 * ASIGNACIÓN, no desde el alta (cambiado el 2026-09-25 — Hugo). Día 4 =
 * NOTICE (aviso interceptor) · día 5 = SUSPENDED (acceso suspendido).
 * Lo que corre el plazo hoy es SUBIR el documento; la retención del 16% es
 * independiente y aplica mientras `has_tax_id` sea false (D-27).
 */
export interface TaxDeadlineApi {
  status: 'OK' | 'NOTICE' | 'SUSPENDED'
  /** Sin asignación todavía el plazo no ha arrancado: `day`/`dueAt` van en null. */
  hasStarted: boolean
  /** Días desde la primera asignación; el día 1 es el de la asignación. */
  day: number | null
  dueAt: string | null
  hasDocument: boolean
  isDocumentVerified: boolean
  taxRetentionApplies: boolean
}

/**
 * Migración de correo: si entré con la cuenta vieja (transición, D-XX),
 * `legacyAccess` trae a cuál correo corporativo cambiar antes de que venza.
 * `null` es el caso normal — la inmensa mayoría no tiene esta fila.
 */
export interface LegacyAccessApi {
  corporateEmail: string
}

/**
 * Los otros dos plazos de 3 días (Reglas de Negocio § Acceso del Colaborador
 * y § Validación con expediente incompleto), calculados al leer como el
 * fiscal. `password`: la contraseña temporal entregada en mano hay que
 * cambiarla desde la app. `profile`: validado con el expediente a medias, hay
 * que completarlo. Vencidos (OVERDUE) el API bloquea todo menos lo que los
 * levanta.
 */
export interface AccessDeadlineApi {
  status: 'NONE' | 'PENDING' | 'OVERDUE'
  day: number | null
  dueAt: string | null
}

export interface AccessDeadlinesApi {
  password: AccessDeadlineApi
  profile: AccessDeadlineApi
}

/** `GET /workers/me`: mi expediente completo (misma entidad que /workers/:id) + los plazos. */
export type MyProfile = WorkerApi & {
  taxDeadline: TaxDeadlineApi
  /** Opcional en el tipo a propósito: un API sin este campo no debe tumbar la app. */
  accessDeadlines?: AccessDeadlinesApi
  legacyAccess: LegacyAccessApi | null
}

/**
 * `PATCH /workers/me/signup` — Fases 2 y 3 (cambio del 2026-08-22): de la
 * Fase 2 solo queda el transporte; posición, modalidad, inglés y experiencia
 * las decide Oranje en la entrevista. Todos opcionales, al menos uno.
 */
export interface CompleteSignupRequest {
  transportType?: string
  photoPath?: string
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
  /** Quien lo disparó con su acción; null en avisos sin actor humano. */
  actor: { id: string; fullName: string; photoUrl: string | null } | null
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
  /** Quien lo disparó con su acción; null en avisos sin actor humano. */
  actor: { id: string; fullName: string; photoUrl: string | null } | null
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
