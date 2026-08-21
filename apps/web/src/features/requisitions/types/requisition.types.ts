import type { RequisitionStatus, UrgencyLevel } from '@/shared/constants/requisitionStatus'

/**
 * Formas de respuesta del tablero de Requisiciones.
 *
 * ⚠ Igual que las demás, su lugar es `packages/contracts` (§5), hoy fuera del
 * alcance acordado.
 */

/** Cuántas posiciones de la requisición están cubiertas. */
export interface RequisitionCoverage {
  filled: number
  total: number
}

export interface RequisitionRow {
  id: string
  /** Folio legible: `202608120930·K7`. Lo genera el backend. */
  number: string
  hotelName: string
  /** Departamento del hotel: `Ama de llaves`, `Alimentos y Bebidas`… */
  department: string
  positions: number
  coverage: RequisitionCoverage
  /**
   * Lo calcula el BACKEND desde la fecha de inicio. Si lo dedujera el front,
   * dos pantallas abiertas a distinta hora mostrarían urgencias distintas.
   */
  urgency: UrgencyLevel
  status: RequisitionStatus
  /** ISO con hora. `null` mientras la requisición no se autoriza. */
  authorizedAt: string | null
  inspectorName: string
}

export interface RequisitionBoardMetrics {
  openCount: number
  openHotels: number
  awaitingAuthorization: number
  /** De las que esperan autorización, cuántas llevan más de 48 h. */
  awaitingOver48h: number
  partialCoverage: number
  freeSlots: number
  urgentCount: number
  /** Identificador del requerimiento que define «urgente». */
  urgentRuleId: string
}

export interface RequisitionBoard {
  metrics: RequisitionBoardMetrics
  items: RequisitionRow[]
}

/**
 * Modalidad e inglés ya NO son listas cerradas en código: son CATÁLOGOS del
 * backend (`catalogs.hiring_modality`, `catalogs.english_level`) y viajan como
 * su NOMBRE ya resuelto. El alta los elige por id desde `RequisitionFormOptions`.
 */

/**
 * Estado del slot. Se guardan los valores del enum de base tal cual —en inglés,
 * minúsculas— porque son los que viajan en la API; la traducción, si se decide
 * mostrarla, es cosa de la vista.
 */
export const SLOT_STATUSES = ['occupied', 'free'] as const

export type SlotStatus = (typeof SLOT_STATUSES)[number]

/**
 * La unidad de bloqueo: una posición de 4 camaristas son 4 slots, y cada uno se
 * ocupa por separado. Un slot libre se puede borrar; uno ocupado no, porque
 * `coverage.assignment` lo referencia.
 */
export interface RequisitionSlot {
  id: string
  /** Ordinal dentro de la posición: el número que se ve en el chip. */
  index: number
  status: SlotStatus
  /** Quién lo ocupa. `null` mientras está libre. */
  assigneeName: string | null
  /** ISO con hora. `null` mientras está libre. */
  assignedAt: string | null
  /** Por dónde se está ofreciendo el slot libre: «Visible en la Bolsa · Self-Pick». */
  offerChannel: string | null
}

export interface RequisitionPosition {
  id: string
  /** Ordinal dentro de la requisición: la columna `#`. */
  index: number
  /** Puesto solicitado: `Camarista`, `Supervisora de piso`… */
  name: string
  /** Cuántas personas se piden. Es también cuántos slots tiene la posición. */
  quantity: number
  /** ISO sin hora: el día en que esta posición entra a trabajar. */
  startDate: string
  /** `HH:mm` en hora del hotel: a qué hora entra ese día. */
  startTime: string
  /** Nombre del nivel de inglés del catálogo; `—` cuando la posición no lo exige. */
  english: string
  coverage: RequisitionCoverage
  /**
   * Se deriva de `startDate`, y la calcula el BACKEND por lo mismo que la del
   * tablero. La urgencia que se ve en el tablero es la más apremiante de estas.
   */
  urgency: UrgencyLevel
  /** Nombre de la modalidad del catálogo: `Tiempo completo`, `Temporal`… */
  modality: string
  slots: RequisitionSlot[]
}

/**
 * Los agregados del encabezado. Vienen del backend aunque las posiciones ya
 * traigan sus slots: es el mismo número que pinta el tablero, y recalcularlo
 * aquí abre la puerta a que las dos pantallas discrepen.
 */
export interface RequisitionTotals {
  positionCount: number
  slotCount: number
  occupiedCount: number
  /** Fracción 0–1; el símbolo lo pone la UI. */
  coverage: number
}

/**
 * Un asiento de `requisition_state_history`. La tabla es append-only —sin
 * `updated_at` ni `deleted_at`—, así que esta lista es el árbitro de en qué
 * estado está una requisición y de quién la movió.
 */
export interface RequisitionStatusEvent {
  id: string
  /** `null` en el alta: la requisición nace directamente en `toStatus`. */
  fromStatus: RequisitionStatus | null
  toStatus: RequisitionStatus
  /** Qué se hizo, en palabras: `Creada`, `Autorizada`… */
  action: string
  byName: string
  at: string
}

export interface RequisitionDetail {
  id: string
  number: string
  hotelName: string
  department: string
  status: RequisitionStatus
  createdByName: string
  createdAt: string
  /** `null` mientras nadie la autoriza. */
  authorizedByName: string | null
  authorizedAt: string | null
  inspectorName: string
  totals: RequisitionTotals
  positions: RequisitionPosition[]
  /** De la más reciente a la más antigua, como se lee. */
  history: RequisitionStatusEvent[]
}

/**
 * Qué pasará con la urgencia si se autoriza ahora. Lo calcula el BACKEND, por
 * lo mismo que la urgencia del tablero: es una función del reloj, y si lo
 * dedujera el front, la advertencia cambiaría según cuándo se abrió la pantalla.
 */
export interface AuthorizationUrgencyPreview {
  /** El inicio más próximo entre todas las posiciones. */
  startDate: string
  daysAhead: number
  /** El semáforo en el que nacerían las posiciones al firmar. */
  urgency: UrgencyLevel
  positionCount: number
}

/** Una requisición esperando firma, con todo lo que hace falta para decidir. */
export interface AuthorizationRequest {
  id: string
  number: string
  hotelName: string
  department: string
  requestedByName: string
  status: RequisitionStatus
  positionCount: number
  slotCount: number
  /** Días hasta el inicio más próximo. Backend, por lo mismo que la urgencia. */
  startsInDays: number
  positions: RequisitionPosition[]
  urgencyPreview: AuthorizationUrgencyPreview
}

export interface AuthorizationQueue {
  /** Ordenadas por fecha de inicio más próxima: lo que primero arde, primero. */
  items: AuthorizationRequest[]
  /** Con qué rol firma quien está viendo la pantalla. */
  authorizerRole: string
  /** Hasta dónde alcanza ese rol: «todos los departamentos de tu hotel». */
  authorizerScope: string
}

/**
 * Un motivo de `catalogs.status_change_reason`. Es un CATÁLOGO del backend y no
 * una lista cerrada en código: se administra sin desplegar front.
 */
export interface StatusChangeReason {
  id: string
  label: string
}

export interface ResolveAuthorizationPayload {
  requisitionId: string
}

/** Una fila de catálogo del backend, tal cual (`/catalogs/*`). */
export interface CatalogOption {
  id: string
  code: string
  name: string
}

/** Un hotel elegible al crear una requisición. Solo clientes activos piden gente. */
export interface RequisitionHotelOption {
  id: string
  name: string
  zoneName: string
}

/** Los catálogos del alta, compuestos de `/catalogs/*` y `/hotels`. */
export interface RequisitionFormOptions {
  hotels: RequisitionHotelOption[]
  departments: CatalogOption[]
  positions: CatalogOption[]
  modalities: CatalogOption[]
  englishLevels: CatalogOption[]
}

/** El cuerpo REAL de `POST /requisitions`: los catálogos van por id. */
export interface CreateRequisitionPosition {
  catalogPositionId: string
  hiringModalityId: string
  hotelDepartmentId: string
  englishLevelId?: string
  quantity: number
  startDate: string
  startTime?: string
}

export interface CreateRequisitionRequest {
  hotelId: string
  positions: CreateRequisitionPosition[]
}
