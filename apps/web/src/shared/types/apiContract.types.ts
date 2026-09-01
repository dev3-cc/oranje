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
  /** URL firmada de la foto del usuario (D-30); `null` sin foto. */
  photoUrl: string | null
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
  /** URL firmada de la foto del BD (D-30); `null` sin foto. */
  photoUrl: string | null
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

export interface ContractRateApi {
  id: string
  /** Decimal serializado (`"170.00"`), como toda tarifa del contrato. */
  payRate: string
  billRate: string
  position: { id: string; code: string; name: string }
}

/** `commercial.contract` como lo sirve la API (`GET /contracts[/:id]`). */
export interface ContractApi {
  id: string
  number: string
  hotel: { id: string; name: string }
  status: string
  validFrom: string
  validTo: string | null
  week: { startDay: number; endDay: number }
  multipliers: {
    overtimeBill: string
    overtimePay: string
    holidayBill: string
    holidayPay: string
  }
  deductsMeals: boolean
  splitsInvoiceByMonth: boolean
  signedAt: string | null
  createdAt: string
  /** Solo el detalle (`GET /contracts/:id`) trae las tarifas. */
  rates?: ContractRateApi[]
}

/** Fila cruda de un catálogo (`/catalogs/*`). */
export interface CatalogItemApi {
  id: string
  code: string
  name: string
}

export interface StatusRefApi {
  code: string
  color: string
  name: string
}

/** `demand.position` como la sirve la API, dentro de su requisición. */
export interface RequisitionPositionApi {
  id: string
  lineNumber: number
  position: CatalogItemApi
  hiringModality: CatalogItemApi
  englishLevel: CatalogItemApi | null
  department: CatalogItemApi
  quantity: number
  startDate: string
  startTime: string | null
  notes: string | null
  coverage: StatusRefApi
  urgency: StatusRefApi | null
  filled: number
}

/** `demand.requisition` como la sirve la API (`GET /requisitions[/:id]`). */
export interface RequisitionApi {
  id: string
  number: string
  /** `photoUrl` compuesta al leer (D-34); opcional: el contrato la está ganando. */
  hotel: { id: string; name: string; photoUrl?: string | null }
  state: StatusRefApi
  areaManagerUserId: string | null
  authorizedBy: string | null
  authorizedAt: string | null
  inspectorId: string | null
  /** Quién la elaboró, para la tarjeta del tablero; opcional: encargo al back. */
  createdBy?: { id: string; fullName: string; photoUrl: string | null } | null
  positions: RequisitionPositionApi[]
  totalSlots: number
  filledSlots: number
  createdAt: string
  updatedAt: string | null
}

/** `coverage.assignment` plana (`GET /requisitions/:id/assignments`). */
export interface AssignmentApi {
  id: string
  type: string
  status: string
  worker: { id: string; fullName: string }
  slot: { id: string; ordinal: number }
  createdAt: string
}

/** `personal.worker` + `vw_worker` como lo sirve la API (`GET /workers[/:id]`). */
export interface WorkerApi {
  id: string
  fullName: string
  /** La foto se captura en la app móvil (Fase 2); no integra el perfil completo. */
  photoUrl: string | null
  birthDate: string
  age: number
  gender: string
  phone: string
  address: string
  zone: CatalogItemApi
  position: CatalogItemApi | null
  englishLevel: CatalogItemApi | null
  hiringModality: CatalogItemApi | null
  experienceLevel: string | null
  transportType: string | null
  emergencyContact: { name: string; phone: string; relationship: string } | null
  bloodType: string | null
  state: StatusRefApi
  isProfileComplete: boolean
  hasTaxId: boolean
  hasAccount: boolean
  isBlacklisted: boolean
  createdAt: string
}

/** Una fila de `GET /workers/:id/history` — `personal.worker_state_history`. */
export interface WorkerHistoryEntryApi {
  id: string
  /** `null` en la primera: nacer en BLANCO no es una transición. */
  fromState: string | null
  toState: string
  reason: string | null
  occurredAt: string
  userName: string
}

/** Una opción de `GET /workers/:id/transitions`, ya filtrada por MI rol. */
export interface WorkerTransitionApi {
  toState: string
  requiresReason: boolean
}

/** Una fila de `GET /workers/:id/documents` — `personal.worker_document`. */
export interface WorkerDocumentApi {
  id: string
  documentType: string
  filePath: string
  /** URL firmada para abrirlo; caduca en una hora y es null si no se pudo firmar. */
  url: string | null
  isVerified: boolean
  verifiedBy: { id: string; fullName: string } | null
  verifiedAt: string | null
  createdAt: string
}

export interface WorkerDocumentListApi {
  data: WorkerDocumentApi[]
  /** D-27: sin el cifrado conectado, `hasTaxId` es false y la retención aplica. */
  meta: { hasTaxId: boolean; taxRetentionApplies: boolean }
}

/** Una marca del ponche (`operations.punch_mark`), como la sirve la API. */
export interface TimesheetPunchApi {
  id: string
  type: string
  serverAt: string
  deviceAt: string | null
  insideGeofence: boolean | null
  isManual: boolean
  manualReason: string | null
}

export interface TimesheetDayApi {
  id: string
  workDate: string
  grossMinutes: number
  netMinutes: number
  lunchDeductionMinutes: number
  actualLunchMinutes: number | null
  overtimeMinutes: number
  isAbsence: boolean
  hasAnomaly: boolean
  reviewNote: string | null
  punches: TimesheetPunchApi[]
}

/** `operations.timesheet` (semana × persona × requisición), `GET /timesheets[/:id]`. */
export interface TimesheetApi {
  id: string
  worker: { id: string; fullName: string }
  requisitionId: string
  weekStart: string
  weekEnd: string
  status: string
  approvedAt: string | null
  days?: TimesheetDayApi[]
  totals?: { grossMinutes: number; netMinutes: number; overtimeMinutes: number }
}

/** `coverage.blacklist_entry` como lo sirve la API (`GET /blacklist`). */
export interface BlacklistEntryApi {
  id: string
  worker: { id: string; fullName: string }
  source: string
  reason: string
  evidencePath: string | null
  occurredAt: string
  isActive: boolean
  enteredBy: { id: string; fullName: string }
  liftedAt: string | null
  liftedBy: { id: string; fullName: string } | null
  liftReason: string | null
}

/** `operations.schedule` (semana × hotel), `GET /schedules`. */
export interface ScheduleApi {
  id: string
  hotel: { id: string; name: string; timeZone: string }
  weekStart: string
  weekEnd: string
  entryCount: number
  createdAt: string
}

/** `operations.schedule_entry`, `GET /schedules/:id/entries`. */
export interface ScheduleEntryApi {
  id: string
  workDate: string
  startsAt: string
  endsAt: string
  minutes: number
  worker: { id: string; fullName: string }
  assignmentId: string
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
