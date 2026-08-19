import type { ContactAttemptOutcome, ContactAttemptType } from '@/shared/constants/contactAttempt'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type { GeoPoint } from '@/shared/types/geo.types'

/**
 * Formas de respuesta de los endpoints de Onboarding.
 *
 * ⚠ Estas interfaces deberían vivir en `packages/contracts` (§5: el contrato de
 * la API se define UNA vez y lo comparten api y web). Ese paquete está fuera
 * del alcance de este trabajo, así que viven aquí y se migran cuando
 * `apps/api` publique sus DTOs. Al migrar, este archivo se borra: no se deja
 * una copia local del contrato.
 *
 * Las fechas viajan como ISO (`2026-05-12`). Los montos como número, nunca
 * como string ya formateado: formatear es cosa de la UI.
 */

export interface ProspectOwner {
  id: string
  name: string
  /** Como se firma en las tarjetas del tablero: `A. Ruiz`. */
  shortName: string
}

export interface ContactAttempt {
  id: string
  /** ISO con hora: el intento ocurre en un momento, no en un día. */
  occurredAt: string
  /**
   * ⚠ `string` y no la lista cerrada a propósito. El modal de registro declara
   * `attempt_type` como CHECK de tres valores (Visita en frío · Llamada ·
   * Correo), pero la bitácora del diseño muestra `Reunión`, y el resultado
   * `En revisión`, que tampoco está entre los cuatro de `outcome`.
   *
   * Mientras esa contradicción no se resuelva, la RESPUESTA se lee permisiva y
   * solo la PETICIÓN usa las listas cerradas. Cuando `apps/api` fije el CHECK,
   * esto pasa a `ContactAttemptType` y la UI traduce el valor a su etiqueta.
   */
  channel: string
  outcome: string
  byName: string
}

/** Tarjeta del tablero. Deliberadamente más chica que `ProspectDetail`. */
export interface ProspectSummary {
  id: string
  hotelName: string
  /** Nombre de la zona del catálogo, ya resuelto por el backend. */
  zone: string
  status: OnboardingStatus
  daysInStatus: number
  lastAttempt: Pick<ContactAttempt, 'channel' | 'outcome'> | null
  latestProposalVersion: number | null
  owner: ProspectOwner
}

/** Filtros del tablero. Viajan como query string al endpoint. */
export interface PipelineFilters {
  /** `null` = todas las zonas. */
  zone: string | null
  ownerId: string | null
  /** Antigüedad mínima sin actividad, en días. `null` = sin filtro. */
  staleDays: number | null
}

export interface PipelineBoard {
  /** Total de prospectos abiertos, no los que caben en la página. */
  openCount: number
  zoneCount: number
  items: ProspectSummary[]
}

export interface HotelData {
  /** Dirección postal; la autollena Places al elegir el sitio. */
  address: string
  generalPhone: string
  /** Id del catálogo; es lo que se guarda y lo que viaja al editar. */
  zoneId: string
  /** Etiqueta ya resuelta por el backend, para pintarla sin pedir el catálogo. */
  zone: string
  /** IANA, p. ej. `America/Cancun`. */
  timeZone: string
  geofenceMeters: number
  /**
   * Dónde está el hotel. La usa el mapa de Mi Territorio y la geocerca.
   * ⚠ `null` mientras `commercial.hotel` no exponga dirección ni pin: el
   * contrato real de `GET /hotels/:id` no trae estos campos todavía.
   */
  location: GeoPoint | null
  /** Foto del hotel según Places; `null` en hoteles capturados sin ella. */
  photoUrl: string | null
  /** `null` mientras el prospecto no se convierte en cliente activo. */
  activatedAsClientAt: string | null
}

/** Fila de `catalogs.zonas`. */
export interface Zone {
  id: string
  label: string
}

/** El edificio, `commercial.hotel`. Un hotel puede tener varios ciclos (D-13). */
export interface HotelPayload {
  name: string
  /** URL de la foto según Places. Opcional: hoteles sin foto siguen valiendo. */
  photoUrl?: string | null
  zoneId: string
  timeZone: string
  address: string
  generalPhone: string
  location: GeoPoint
  geofenceMeters: number
}

/** El primer contacto del hotel, `commercial.hotel_contact`. */
export interface HotelContactPayload {
  fullName: string
  jobTitle: string
  phone: string
  email: string
  isPrimary: boolean
}

/**
 * Alta de un prospecto: abre el ciclo comercial. El semáforo arranca en GRIS y
 * lo fija el backend (`ck_prospect_light`), no el formulario.
 */
export interface CreateProspectRequest {
  /** `EXISTING` reusa un hotel ya registrado en vez de dar de alta otro. */
  hotelSource: 'NEW' | 'EXISTING'
  existingHotelId?: string
  hotel: HotelPayload
  contact: HotelContactPayload
  ownerUserId: string
  needDescription: string
}

/** Edición: los mismos datos, sin tocar el semáforo ni el historial. */
export interface UpdateProspectRequest {
  prospectId: string
  hotel: HotelPayload
  /** Se omite cuando el prospecto todavía no tiene contacto. */
  contact?: HotelContactPayload
  ownerUserId: string
  needDescription: string
}

/** Hotel ya dado de alta, para el modo «Hotel ya registrado». */
export interface RegisteredHotel extends Omit<HotelPayload, 'location'> {
  id: string
  /** Etiqueta de la zona, ya resuelta. */
  zone: string
  /** Mismo hueco que `HotelData`: la API aún no expone el pin. */
  location: GeoPoint | null
}

export interface HotelContact {
  id: string
  name: string
  /** Puesto en el hotel: `Gerente de Compras`, `Ama de Llaves`… */
  role: string
  /** `hotel_contact` solo exige `full_name` y `hotel_id`: lo demás puede venir vacío. */
  phone: string
  email: string
  isPrimary: boolean
}

/**
 * Una fila de `prospect_state_history`. Es la verdad del semáforo: el estado
 * actual del prospecto es el `toStatus` de la entrada más reciente.
 */
export interface StatusHistoryEntry {
  id: string
  /** `null` en el alta: no había estado previo. */
  fromStatus: OnboardingStatus | null
  toStatus: OnboardingStatus
  changedAt: string
  byName: string
  /** Rol con el que se ejecutó el cambio: `BD`, `BDC`. */
  byRole: string
  note: string
}

export interface ProspectDetail {
  id: string
  hotelName: string
  status: OnboardingStatus
  cycleStartedAt: string
  daysInStatus: number
  owner: ProspectOwner
  hotel: HotelData
  /** Qué pidió el hotel al abrir el ciclo. `need_description`. */
  needDescription: string
  contacts: HotelContact[]
  attempts: ContactAttempt[]
  /**
   * Las propuestas NO viajan aquí: viven en `GET /prospects/:id/proposals`, que
   * es el mismo endpoint que usa el editor. Tenerlas en dos sitios haría que la
   * ficha mostrara una versión y el editor otra.
   */
  history: StatusHistoryEntry[]
}

/**
 * Transición que el rol de quien pregunta SÍ puede ejecutar. El filtro por rol
 * es del backend: el front pinta lo que recibe y nunca decide permisos.
 */
export interface AllowedTransition {
  toStatus: OnboardingStatus
  title: string
  description: string
  /** `requires_reason` de la transición en catálogo. */
  requiresReason: boolean
}

export interface AllowedTransitions {
  transitions: AllowedTransition[]
  /**
   * Explica una transición que existe pero el rol no ve. Lo redacta el backend
   * porque solo él sabe por qué se filtró; `null` si no se ocultó ninguna.
   */
  restrictionNote: string | null
}

/** Fila de `catalogs.status_change_reason`. */
export interface StatusChangeReason {
  id: string
  label: string
}

export interface RegisterContactAttemptRequest {
  prospectId: string
  attemptType: ContactAttemptType
  outcome: ContactAttemptOutcome
  /** ISO con hora. */
  occurredAt: string
  /** Se omite cuando no se encontró a nadie. */
  hotelContactId?: string
  notes?: string
}

export interface ChangeStatusRequest {
  prospectId: string
  toStatus: OnboardingStatus
  reasonId?: string
}
