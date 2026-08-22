/**
 * Formas del apartado del Colaborador (web responsive de las pantallas
 * móviles). El contrato propio-de-la-persona (`/workers/me`, `/notifications`)
 * lo está construyendo la sesión de backend; estas formas SON ese contrato.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5).
 */

/** Mi expediente, como me lo devuelve `GET /workers/me`. */
export interface MyProfile {
  id: string
  fullName: string
  photoUrl: string | null
  statusCode: string
  statusLabel: string
  isProfileComplete: boolean
  /** Fase 2 · perfil laboral (ids de catálogo; null = sin capturar). */
  catalogPositionId: string | null
  englishLevelId: string | null
  hiringModalityId: string | null
  experienceLevel: string | null
  transportType: string | null
  /** Fase 3 · emergencia y salud. */
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  bloodType: string | null
  medicalNotes: string | null
}

/** Lo que la Fase 2 envía (`PATCH /workers/me`), con los nombres del DTO real. */
export interface UpdatePhase2Request {
  catalogPositionId: string
  englishLevelId: string
  hiringModalityId: string
  experienceLevel: string
  transportType: string
  photoPath?: string
}

export interface UpdatePhase3Request {
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string
  bloodType: string
  medicalNotes?: string | null
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

// ── Los enum del CHECK real (create-worker.dto.ts del backend) ──

export const EXPERIENCE_LEVELS = ['NONE', 'ONE_TO_TWO', 'THREE_TO_FIVE', 'MORE_THAN_FIVE'] as const
export const EXPERIENCE_LABEL: Record<string, string> = {
  NONE: 'Sin experiencia',
  ONE_TO_TWO: '1–2 años',
  THREE_TO_FIVE: '3–5 años',
  MORE_THAN_FIVE: 'Más de 5 años',
}

export const TRANSPORT_TYPES = ['OWN', 'PUBLIC', 'OTHER'] as const
export const TRANSPORT_LABEL: Record<string, string> = {
  OWN: 'Propio',
  PUBLIC: 'Público',
  OTHER: 'Otro',
}

export const RELATIONSHIPS = [
  'MOTHER',
  'FATHER',
  'SPOUSE',
  'SIBLING',
  'CHILD',
  'FRIEND',
  'OTHER',
] as const
export const RELATIONSHIP_LABEL: Record<string, string> = {
  MOTHER: 'Madre',
  FATHER: 'Padre',
  SPOUSE: 'Cónyuge',
  SIBLING: 'Hermano/a',
  CHILD: 'Hijo/a',
  FRIEND: 'Amistad',
  OTHER: 'Otro',
}

export const BLOOD_TYPES = [
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
  'UNKNOWN',
] as const
export const BLOOD_LABEL: Record<string, string> = {
  A_POS: 'A+',
  A_NEG: 'A−',
  B_POS: 'B+',
  B_NEG: 'B−',
  AB_POS: 'AB+',
  AB_NEG: 'AB−',
  O_POS: 'O+',
  O_NEG: 'O−',
  UNKNOWN: 'No sé',
}
