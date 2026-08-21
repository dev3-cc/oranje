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

// --- identity/auth ---------------------------------------------------------

/**
 * `POST /auth/session` y `POST /auth/refresh`. El refresh token NUNCA viaja en
 * el body: va en la cookie `oranje_refresh` (`httpOnly`, `path=/api/v1/auth`),
 * así que ambas llamadas exigen `credentials: 'include'`.
 */
export interface SessionApi {
  accessToken: string
  /** Segundos de vida del access token (default 900). */
  expiresIn: number
  user: {
    id: string
    email: string
    fullName: string
    roleCode: string
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
  address: string | null
  placeId: string | null
  photoUrl: string | null
  latitude: number | null
  longitude: number | null
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

// --- catalogs --------------------------------------------------------------

export interface CatalogItemApi {
  id: string
  code: string
  name: string
}

export interface ReasonItemApi {
  id: string
  code: string
  name: string
  statusLight: string
}

// --- identity/users (GET /me) ----------------------------------------------

export interface MeApi {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string; department: string | null }
  hotel: { id: string; name: string } | null
  department: { id: string; code: string; name: string } | null
  zones: ZoneRefApi[]
  /** Permisos aplanados `modulo.accion`: el sidebar decide qué pinta sin adivinar. */
  permissions: string[]
}

/** `GET /team`: los BDs a cargo del BDC. Vacío si nadie le reporta. */
export interface TeamMemberApi {
  id: string
  fullName: string
  email: string
  role: { code: string; name: string }
  zones: ZoneRefApi[]
  openProspects: number
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
  hotel: { id: string; name: string; photoUrl: string | null; zone: ZoneRefApi }
  owner: { id: string; fullName: string }
  state: ProspectStateApi
  stateSince: string
  needDescription: string | null
  openedAt: string
  closedAt: string | null
  attemptCount: number
  isOpen: boolean
  /** Lo que la tarjeta del tablero muestra sin N+1 llamadas. */
  lastAttempt: { occurredAt: string; attemptType: string; outcome: string } | null
  lastProposal: { version: number; isDraft: boolean; sentAt: string | null } | null
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
