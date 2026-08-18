/**
 * Formas CRUDAS que sirve `apps/api` — el contrato HTTP real, transcrito de sus
 * entities y DTOs. Las features NO consumen esto directamente: cada `*Api.ts`
 * adapta estas formas a sus tipos de vista con `transformResponse`/`queryFn`.
 *
 * ⚠ Su lugar definitivo es `packages/contracts` (§5: el contrato se define UNA
 * vez y lo comparten api y web). Cuando ese paquete exista, este archivo se
 * borra — no se deja copia local.
 */

/** Toda respuesta de la API envuelve el recurso en `data`. */
export interface ApiEnvelope<T> {
  data: T
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedEnvelope<T, M extends PaginationMeta = PaginationMeta> {
  data: T[]
  meta: M
}

/** Forma de error única del filtro de la API. El front decide con `code`. */
export interface ApiError {
  error: {
    code: string
    message: string
    details?: Array<{ field: string; message?: string; value?: unknown }>
    traceId: string
  }
}

// --- commercial/hotels -----------------------------------------------------

export interface ZoneRefApi {
  id: string
  code: string
  name: string
}

export interface HotelApi {
  id: string
  name: string
  generalPhone: string | null
  timeZone: string
  geofenceRadiusM: number | null
  zone: ZoneRefApi
  isClient: boolean
  activatedAt: string | null
  contactCount: number
  createdAt: string
  updatedAt: string | null
}

export interface HotelContactApi {
  id: string
  hotelId: string
  fullName: string
  jobTitle: string | null
  phone: string | null
  email: string | null
  isPrimary: boolean
  isActive: boolean
  attemptCount: number
  canDelete: boolean
  createdAt: string
}

// --- commercial/onboarding -------------------------------------------------

export interface ProspectStateApi {
  code: string
  color: string
  name: string
  isBranch: boolean
  displayOrder: number
}

export interface ProspectApi {
  id: string
  hotel: { id: string; name: string; zone: ZoneRefApi }
  owner: { id: string; fullName: string }
  state: ProspectStateApi
  stateSince: string
  needDescription: string | null
  openedAt: string
  closedAt: string | null
  attemptCount: number
  isOpen: boolean
}

/** `meta` extra del tablero: total por estado, con 0 cuando no hay. */
export interface ProspectBoardMeta extends PaginationMeta {
  byState: Array<{ code: string; total: number }>
}

export interface ContactAttemptApi {
  id: string
  attemptType: string
  outcome: string
  contact: { id: string; fullName: string; jobTitle: string | null } | null
  user: { id: string; fullName: string }
  occurredAt: string
  notes: string | null
}

export interface AttemptSummaryApi {
  total: number
  byOutcome: Array<{ outcome: string; total: number }>
  lastAttemptAt: string | null
}

export interface TransitionOptionApi {
  toState: { code: string; color: string; name: string; isBranch: boolean }
  requiresReason: boolean
  requiresEvidence: boolean
}

export interface HistoryEntryApi {
  id: string
  fromState: { code: string; name: string } | null
  toState: { code: string; name: string }
  reason: { code: string; name: string } | null
  user: { id: string; fullName: string }
  occurredAt: string
}

/** Respuesta de `POST /prospects/:id/transitions`: códigos, no el prospecto. */
export interface TransitionResultApi {
  from: string
  to: string
}

export interface ProposalApi {
  id: string
  version: number
  servicesNote: string | null
  /** Decimal serializado (`"1250.0000"`). En la petición TAMBIÉN va string. */
  payRate: string | null
  billRate: string | null
  isDraft: boolean
  sentBy: { id: string; fullName: string } | null
  sentAt: string | null
  createdAt: string
  updatedAt: string | null
}
