import type {
  ContactAttempt,
  HotelContact,
  ProspectDetail,
  ProspectSummary,
  RegisteredHotel,
  StatusChangeReason,
  StatusHistoryEntry,
  Zone,
} from '../types/prospect.types'

import {
  CONTACT_ATTEMPT_OUTCOME_LABEL,
  CONTACT_ATTEMPT_TYPE_LABEL,
  type ContactAttemptOutcome,
  type ContactAttemptType,
} from '@/shared/constants/contactAttempt'
import {
  ONBOARDING_STATUS_DESCRIPTION,
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_TRANSITIONS,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type {
  ApiEnvelope,
  AttemptSummaryApi,
  ContactAttemptApi,
  HistoryEntryApi,
  HotelApi,
  HotelContactApi,
  PaginatedEnvelope,
  ProspectApi,
  ProspectBoardMeta,
  TransitionOptionApi,
  TransitionResultApi,
  ZoneRefApi,
} from '@/shared/types/apiContract.types'
import type { GeoPoint } from '@/shared/types/geo.types'

/**
 * Fixtures de Onboarding. ANDAMIO TEMPORAL — se borra completo cuando
 * `VITE_USE_MOCKS` deje de usarse; no queda nada de esto en el front.
 *
 * El ESTADO interno sigue en tipos de vista (los fixtures ricos de las
 * capturas), pero las rutas responden las formas CRUDAS del contrato real
 * (`apiContract.types.ts`), con su envoltura `{data, meta}`: así los
 * adaptadores de `adapters.ts` se ejercitan igual con mocks que contra la API.
 */

const OWNER_ANA = { id: 'usr-ana-ruiz', name: 'Ana Ruiz', shortName: 'A. Ruiz' }

/** Rol de la sesión simulada. En el backend sale del token, no de una constante. */
const CURRENT_ROLE: string = 'BD'

/** Transiciones que solo el BDC puede ejecutar (RBAC simulado). */
const BDC_ONLY_TRANSITIONS: readonly OnboardingStatus[] = ['ORANGE']

/** Motivo obligatorio: como en el seed, todo lo que cierra o desbloquea un ciclo. */
const TRANSITIONS_REQUIRING_REASON: readonly OnboardingStatus[] = ['RED', 'BROWN', 'BLACK']

/** Frase corta de la transición; alimenta la nota del historial simulado. */
const TRANSITION_HINT: Record<OnboardingStatus, string> = {
  GRAY: 'Alta del hotel en el pipeline',
  LIGHT_BLUE: 'Se inicia el contacto',
  GREEN: 'Se envía la propuesta',
  YELLOW: 'El hotel responde con interés',
  PINK: 'Se crea y valida el T&C',
  BROWN: 'No se cierra el acuerdo',
  ORANGE: 'Se aprueba la conversión a cliente',
  RED: 'No hay interés',
  BLACK: 'El cliente se pausa o queda inactivo',
}

const REASONS_BY_STATUS: Partial<Record<OnboardingStatus, StatusChangeReason[]>> = {
  RED: [
    { id: 'rsn-precio', label: 'Precio fuera de presupuesto' },
    { id: 'rsn-competencia', label: 'Trabaja con otro proveedor' },
    { id: 'rsn-sin-necesidad', label: 'No tiene necesidad de personal' },
    { id: 'rsn-sin-respuesta', label: 'Dejó de contestar' },
    { id: 'rsn-cierre', label: 'Cierre temporal del hotel' },
  ],
  BROWN: [
    { id: 'rsn-renegocia-tarifa', label: 'Pide renegociar la tarifa' },
    { id: 'rsn-cambio-contacto', label: 'Cambió el contacto en el hotel' },
    { id: 'rsn-presupuesto', label: 'Presupuesto congelado' },
    { id: 'rsn-corporativo', label: 'Requiere aprobación corporativa' },
  ],
}

const PROSPECT_PUERTO_REAL_ID = 'psp-0007'

/** `catalogs.zone`. El id es lo que se guarda; la etiqueta, lo que se pinta. */
const ZONES: Zone[] = [
  { id: 'norte', label: 'Zona Norte' },
  { id: 'centro', label: 'Zona Centro' },
  { id: 'sur', label: 'Zona Sur' },
  { id: 'poniente', label: 'Zona Poniente' },
]

/** Punto de referencia por zona, para los prospectos que no traen coordenada propia. */
const ZONE_ANCHOR: Record<string, GeoPoint> = {
  norte: { lat: 21.1743, lng: -86.8466 },
  centro: { lat: 21.1619, lng: -86.8515 },
  sur: { lat: 21.118, lng: -86.848 },
  poniente: { lat: 21.1465, lng: -86.8752 },
}

function zoneIdFromLabel(label: string): string {
  return ZONES.find((zone) => zone.label === label)?.id ?? 'centro'
}

function zoneRef(zoneId: string): ZoneRefApi {
  const zone = ZONES.find((item) => item.id === zoneId)
  return {
    id: zoneId,
    code: zoneId.toUpperCase(),
    name: zone?.label ?? 'Zona Centro',
  }
}

/** Estado mutable: una mutación tiene que verse reflejada en la siguiente lectura. */
let board: ProspectSummary[] = [
  {
    id: 'psp-0001',
    hotelName: 'Hotel Riviera Maya',
    zone: 'Zona Norte',
    status: 'GRAY',
    daysInStatus: 4,
    lastAttempt: null,
    latestProposalVersion: null,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0002',
    hotelName: 'Casa Tulum Boutique',
    zone: 'Zona Sur',
    status: 'GRAY',
    daysInStatus: 11,
    lastAttempt: null,
    latestProposalVersion: null,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0003',
    hotelName: 'Hotel Playa Azul',
    zone: 'Zona Centro',
    status: 'GRAY',
    daysInStatus: 2,
    lastAttempt: null,
    latestProposalVersion: null,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0004',
    hotelName: 'Grand Costa Nube',
    zone: 'Zona Norte',
    status: 'LIGHT_BLUE',
    daysInStatus: 6,
    lastAttempt: { channel: 'Llamada', outcome: 'Interesado' },
    latestProposalVersion: null,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0005',
    hotelName: 'Hotel Bahía Serena',
    zone: 'Zona Poniente',
    status: 'LIGHT_BLUE',
    daysInStatus: 3,
    lastAttempt: { channel: 'Visita', outcome: 'Cita agendada' },
    latestProposalVersion: null,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0006',
    hotelName: 'Suites del Carmen',
    zone: 'Zona Sur',
    status: 'LIGHT_BLUE',
    daysInStatus: 9,
    lastAttempt: { channel: 'Correo', outcome: 'No contestó' },
    latestProposalVersion: null,
    owner: OWNER_ANA,
  },
  {
    id: PROSPECT_PUERTO_REAL_ID,
    hotelName: 'Hotel Puerto Real',
    zone: 'Zona Centro',
    status: 'PINK',
    daysInStatus: 7,
    lastAttempt: { channel: 'Reunión', outcome: 'En revisión' },
    latestProposalVersion: 2,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0008',
    hotelName: 'Hotel Mirador',
    zone: 'Zona Centro',
    status: 'GREEN',
    daysInStatus: 5,
    lastAttempt: { channel: 'Correo', outcome: 'Interesado' },
    latestProposalVersion: 2,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0009',
    hotelName: 'Resort Isla Blanca',
    zone: 'Zona Norte',
    status: 'GREEN',
    daysInStatus: 12,
    lastAttempt: { channel: 'Llamada', outcome: 'Interesado' },
    latestProposalVersion: 1,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0010',
    hotelName: 'Hotel Las Palmas',
    zone: 'Zona Sur',
    status: 'YELLOW',
    daysInStatus: 8,
    lastAttempt: { channel: 'Llamada', outcome: 'Interesado' },
    latestProposalVersion: 1,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0011',
    hotelName: 'Villas Coral',
    zone: 'Zona Poniente',
    status: 'YELLOW',
    daysInStatus: 15,
    lastAttempt: { channel: 'Correo', outcome: 'Sin respuesta' },
    latestProposalVersion: 1,
    owner: OWNER_ANA,
  },
  /*
   * Los cinco convertidos: son los hoteles de Clientes Activos.
   *
   * Están en el tablero porque el detalle y las propuestas se resuelven desde
   * aquí, pero NO se pintan en él: `PIPELINE_COLUMNS` deja fuera `ORANGE` por
   * ser terminal, y el tablero es de prospectos abiertos.
   *
   * ⚠ Repiten el nombre de cinco prospectos abiertos. Es artefacto de fixture:
   * en la base hay UNA fila por hotel y este par sería la misma. Se mantiene
   * así para no convertir a Puerto Real —el prospecto de las capturas del
   * Pipeline, con sus propuestas y su contrato— en terminal y dejar esa
   * pantalla sin transiciones que ofrecer.
   */
  {
    id: 'psp-0012',
    hotelName: 'Hotel Puerto Real',
    zone: 'Zona Centro',
    status: 'ORANGE',
    daysInStatus: 37,
    lastAttempt: { channel: 'Reunión', outcome: 'Contrato firmado' },
    latestProposalVersion: 2,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0013',
    hotelName: 'Grand Costa Nube',
    zone: 'Zona Norte',
    status: 'ORANGE',
    daysInStatus: 85,
    lastAttempt: { channel: 'Reunión', outcome: 'Contrato firmado' },
    latestProposalVersion: 3,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0014',
    hotelName: 'Hotel Mirador',
    zone: 'Zona Centro',
    status: 'ORANGE',
    daysInStatus: 164,
    lastAttempt: { channel: 'Llamada', outcome: 'Contrato firmado' },
    latestProposalVersion: 2,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0015',
    hotelName: 'Villas Coral',
    zone: 'Zona Poniente',
    status: 'ORANGE',
    daysInStatus: 212,
    lastAttempt: { channel: 'Correo', outcome: 'Contrato firmado' },
    latestProposalVersion: 1,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0016',
    hotelName: 'Hotel Las Palmas',
    zone: 'Zona Norte',
    status: 'ORANGE',
    daysInStatus: 285,
    lastAttempt: { channel: 'Visita', outcome: 'Contrato firmado' },
    latestProposalVersion: 1,
    owner: OWNER_ANA,
  },
]

/** Solo Puerto Real está detallado: es el prospecto de las capturas 2 y 3. */
const details = new Map<string, ProspectDetail>([
  [
    PROSPECT_PUERTO_REAL_ID,
    {
      id: PROSPECT_PUERTO_REAL_ID,
      hotelName: 'Hotel Puerto Real',
      status: 'PINK',
      cycleStartedAt: '2026-05-12',
      daysInStatus: 7,
      owner: OWNER_ANA,
      needDescription: '2 camaristas y 1 houseman',
      hotel: {
        address: 'Blvd. Kukulcán km 9.5, Zona Hotelera, Cancún',
        generalPhone: '+52 998 123 4567',
        zoneId: 'centro',
        zone: 'Zona Centro',
        timeZone: 'America/Cancun',
        geofenceMeters: 150,
        location: { lat: 21.1619, lng: -86.8515 },
        activatedAsClientAt: null,
      },
      contacts: [
        {
          id: 'ctc-marta',
          name: 'Marta Solís',
          role: 'Gerente de Compras',
          phone: '+52 998 111 2233',
          email: 'marta.solis@puertoreal.mx',
          isPrimary: true,
        },
        {
          id: 'ctc-jorge',
          name: 'Jorge Peña',
          role: 'Ama de Llaves',
          phone: '+52 998 444 5566',
          email: '',
          isPrimary: false,
        },
        {
          id: 'ctc-luis',
          name: 'Luis Cano',
          role: 'Recepción',
          phone: '+52 998 777 8899',
          email: '',
          isPrimary: false,
        },
      ],
      attempts: [
        {
          id: 'att-4',
          occurredAt: '2026-06-18T11:30:00',
          channel: 'Reunión',
          outcome: 'En revisión',
          byName: 'Lucía Márquez',
        },
        {
          id: 'att-3',
          occurredAt: '2026-06-02T09:15:00',
          channel: 'Llamada',
          outcome: 'Interesado',
          byName: 'Ana Ruiz',
        },
        {
          id: 'att-2',
          occurredAt: '2026-05-21T16:40:00',
          channel: 'Correo',
          outcome: 'Interesado',
          byName: 'Ana Ruiz',
        },
        {
          id: 'att-1',
          occurredAt: '2026-05-12T10:00:00',
          channel: 'Visita en frío',
          outcome: 'Cita agendada',
          byName: 'Ana Ruiz',
        },
      ],
      history: [
        {
          id: 'hst-5',
          fromStatus: 'YELLOW',
          toStatus: 'PINK',
          changedAt: '2026-06-18',
          byName: 'Lucía Márquez',
          byRole: 'BDC',
          note: 'T&C creado y validado',
        },
        {
          id: 'hst-4',
          fromStatus: 'GREEN',
          toStatus: 'YELLOW',
          changedAt: '2026-06-03',
          byName: 'Ana Ruiz',
          byRole: 'BD',
          note: 'El hotel responde con interés',
        },
        {
          id: 'hst-3',
          fromStatus: 'LIGHT_BLUE',
          toStatus: 'GREEN',
          changedAt: '2026-05-21',
          byName: 'Ana Ruiz',
          byRole: 'BD',
          note: 'Propuesta v1 enviada',
        },
        {
          id: 'hst-2',
          fromStatus: 'GRAY',
          toStatus: 'LIGHT_BLUE',
          changedAt: '2026-05-14',
          byName: 'Ana Ruiz',
          byRole: 'BD',
          note: 'Inicia contacto',
        },
        {
          id: 'hst-1',
          fromStatus: null,
          toStatus: 'GRAY',
          changedAt: '2026-05-12',
          byName: 'Ana Ruiz',
          byRole: 'BD',
          note: 'Hotel identificado',
        },
      ],
    },
  ],
])

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Con `noUncheckedIndexedAccess`, leer un parámetro de ruta devuelve `string | undefined`. */
function requireParam(params: Readonly<Record<string, string>>, name: string): string {
  const value = params[name]
  if (!value) throw new Error(`Falta el parámetro de ruta ${name}`)
  return value
}

/**
 * El camino de GRIS a NARANJA, paso a paso y respetando
 * `ONBOARDING_TRANSITIONS`. Un convertido no puede tener un historial que salte
 * de «Hotel identificado» a «Cliente activo»: esa transición no existe, y el
 * backend jamás podría escribirla.
 */
const CONVERSION_PATH: readonly OnboardingStatus[] = [
  'GRAY',
  'LIGHT_BLUE',
  'GREEN',
  'YELLOW',
  'PINK',
  'ORANGE',
]

/**
 * Historial de un prospecto sin captura propia.
 *
 * Para los convertidos se recorre el camino completo; para el resto basta el
 * asiento de alta, que es lo único que se sabe de cierto.
 */
function buildHistory(summary: ProspectSummary, cycleStartedAt: string): StatusHistoryEntry[] {
  const path = summary.status === 'ORANGE' ? CONVERSION_PATH : ['GRAY' as OnboardingStatus]

  return path.map((status, index) => ({
    id: `hst-${summary.id}-${String(index + 1)}`,
    fromStatus: index === 0 ? null : (path[index - 1] ?? null),
    changedAt: cycleStartedAt,
    toStatus: status,
    byName: summary.owner.name,
    byRole: CURRENT_ROLE,
    note: ONBOARDING_STATUS_DESCRIPTION[status],
  }))
}

/** Detalle mínimo para un prospecto que no está en las capturas. */
function buildDetailFromSummary(summary: ProspectSummary): ProspectDetail {
  const cycleStartedAt = isoDaysAgo(summary.daysInStatus)

  return {
    id: summary.id,
    hotelName: summary.hotelName,
    status: summary.status,
    cycleStartedAt,
    daysInStatus: summary.daysInStatus,
    owner: summary.owner,
    needDescription: '',
    hotel: {
      address: '',
      generalPhone: '+52 998 000 0000',
      zoneId: zoneIdFromLabel(summary.zone),
      zone: summary.zone,
      timeZone: 'America/Cancun',
      geofenceMeters: 150,
      location: ZONE_ANCHOR[zoneIdFromLabel(summary.zone)] ?? ZONE_ANCHOR.centro!,
      // Solo un hotel convertido tiene fecha de alta como cliente.
      activatedAsClientAt: summary.status === 'ORANGE' ? cycleStartedAt : null,
    },
    contacts: [],
    attempts: [],
    history: buildHistory(summary, cycleStartedAt),
  }
}

/**
 * Identidad del prospecto para los fixtures de propuestas, que están en otro
 * archivo de la misma feature. Evita repetir nombres y semáforos en dos sitios:
 * el hotel se llama igual en la ficha y en su propuesta.
 */
export function getProspectIdentity(
  prospectId: string,
): { hotelName: string; status: OnboardingStatus; zone: string } | null {
  const summary = board.find((item) => item.id === prospectId)
  if (!summary) return null
  return { hotelName: summary.hotelName, status: summary.status, zone: summary.zone }
}

function readDetail(prospectId: string): ProspectDetail {
  const existing = details.get(prospectId)
  if (existing) return existing

  const summary = board.find((item) => item.id === prospectId)
  if (!summary) throw new Error(`No existe el prospecto ${prospectId}`)

  const built = buildDetailFromSummary(summary)
  details.set(prospectId, built)
  return built
}

// ---------------------------------------------------------------------------
// Serializadores vista → contrato crudo. Son la INVERSA de `adapters.ts`: el
// estado interno sigue siendo el de las capturas, pero por el cable viajan las
// formas que sirve `apps/api`.
// ---------------------------------------------------------------------------

/** Orden del semáforo en el seed; alimenta `displayOrder` y `meta.byState`. */
const STATE_ORDER: readonly OnboardingStatus[] = [
  'GRAY',
  'LIGHT_BLUE',
  'GREEN',
  'YELLOW',
  'PINK',
  'ORANGE',
  'RED',
  'BROWN',
  'BLACK',
]

const BRANCH_STATES: readonly OnboardingStatus[] = ['RED', 'BROWN', 'BLACK']

function stateApi(status: OnboardingStatus): ProspectApi['state'] {
  return {
    code: status,
    color: ONBOARDING_STATUS_LABEL[status],
    name: ONBOARDING_STATUS_DESCRIPTION[status],
    isBranch: BRANCH_STATES.includes(status),
    displayOrder: STATE_ORDER.indexOf(status) + 1,
  }
}

/** El id del hotel de un prospecto se deriva del prospecto: una fila por ciclo. */
function hotelIdOf(prospectId: string): string {
  return `htl-${prospectId}`
}

function prospectIdOfHotel(hotelId: string): string | null {
  return hotelId.startsWith('htl-psp-') ? hotelId.slice(4) : null
}

function toProspectApi(summary: ProspectSummary): ProspectApi {
  const detail = readDetail(summary.id)
  return {
    id: summary.id,
    hotel: {
      id: hotelIdOf(summary.id),
      name: summary.hotelName,
      zone: zoneRef(zoneIdFromLabel(summary.zone)),
    },
    owner: { id: summary.owner.id, fullName: summary.owner.name },
    state: stateApi(summary.status),
    stateSince: isoDaysAgo(summary.daysInStatus),
    needDescription: detail.needDescription || null,
    openedAt: detail.cycleStartedAt,
    closedAt: null,
    attemptCount: detail.attempts.length,
    isOpen: true,
  }
}

function toHotelApi(detail: ProspectDetail): HotelApi {
  return {
    id: hotelIdOf(detail.id),
    name: detail.hotelName,
    generalPhone: detail.hotel.generalPhone || null,
    timeZone: detail.hotel.timeZone,
    geofenceRadiusM: detail.hotel.geofenceMeters || null,
    zone: zoneRef(detail.hotel.zoneId),
    isClient: detail.hotel.activatedAsClientAt !== null,
    activatedAt: detail.hotel.activatedAsClientAt,
    contactCount: detail.contacts.length,
    createdAt: detail.cycleStartedAt,
    updatedAt: null,
  }
}

function registeredToHotelApi(hotel: RegisteredHotel): HotelApi {
  return {
    id: hotel.id,
    name: hotel.name,
    generalPhone: hotel.generalPhone || null,
    timeZone: hotel.timeZone,
    geofenceRadiusM: hotel.geofenceMeters || null,
    zone: zoneRef(hotel.zoneId),
    isClient: false,
    activatedAt: null,
    contactCount: 0,
    createdAt: isoDaysAgo(30),
    updatedAt: null,
  }
}

function toContactApi(contact: HotelContact, hotelId: string): HotelContactApi {
  return {
    id: contact.id,
    hotelId,
    fullName: contact.name,
    jobTitle: contact.role || null,
    phone: contact.phone || null,
    email: contact.email || null,
    isPrimary: contact.isPrimary,
    isActive: true,
    attemptCount: 0,
    canDelete: true,
    createdAt: isoDaysAgo(7),
  }
}

/**
 * La vista guarda ETIQUETAS (`Llamada`); el contrato lleva CÓDIGOS
 * (`CALL`). Para las etiquetas históricas sin código (`Reunión`, `Visita`) se
 * deja pasar la etiqueta: `adaptAttempt` la pinta tal cual con su `?? type`.
 */
function codeForLabel(label: string, catalog: Record<string, string>): string {
  const found = Object.entries(catalog).find(([, itemLabel]) => itemLabel === label)
  return found ? found[0] : label
}

function toAttemptApi(attempt: ContactAttempt): ContactAttemptApi {
  return {
    id: attempt.id,
    attemptType: codeForLabel(attempt.channel, CONTACT_ATTEMPT_TYPE_LABEL),
    outcome: codeForLabel(attempt.outcome, CONTACT_ATTEMPT_OUTCOME_LABEL),
    contact: null,
    user: { id: OWNER_ANA.id, fullName: attempt.byName },
    occurredAt: attempt.occurredAt,
    notes: null,
  }
}

/**
 * La nota de la vista viaja como `reason.name`: es lo que `adaptHistoryEntry`
 * vuelve a leer. `byRole` NO viaja — el contrato real no lo trae.
 */
function toHistoryApi(entry: StatusHistoryEntry): HistoryEntryApi {
  return {
    id: entry.id,
    fromState: entry.fromStatus
      ? { code: entry.fromStatus, name: ONBOARDING_STATUS_DESCRIPTION[entry.fromStatus] }
      : null,
    toState: { code: entry.toStatus, name: ONBOARDING_STATUS_DESCRIPTION[entry.toStatus] },
    reason: entry.note ? { code: 'NOTE', name: entry.note } : null,
    user: { id: OWNER_ANA.id, fullName: entry.byName },
    occurredAt: entry.changedAt,
  }
}

function buildTransitionOptions(status: OnboardingStatus): TransitionOptionApi[] {
  const all = ONBOARDING_TRANSITIONS[status]
  // RBAC simulado: el backend real filtra por el rol del token.
  const visible = all.filter(
    (target) => CURRENT_ROLE === 'BDC' || !BDC_ONLY_TRANSITIONS.includes(target),
  )

  return visible.map((target) => ({
    toState: {
      code: target,
      color: ONBOARDING_STATUS_LABEL[target],
      name: ONBOARDING_STATUS_DESCRIPTION[target],
      isBranch: BRANCH_STATES.includes(target),
    },
    requiresReason: TRANSITIONS_REQUIRING_REASON.includes(target),
    requiresEvidence: false,
  }))
}

function buildAttemptSummary(attempts: ContactAttempt[]): AttemptSummaryApi {
  const codes = attempts.map((attempt) =>
    codeForLabel(attempt.outcome, CONTACT_ATTEMPT_OUTCOME_LABEL),
  )
  return {
    total: attempts.length,
    byOutcome: (['NO_ANSWER', 'INTERESTED', 'NOT_INTERESTED', 'MEETING_SET'] as const).map(
      (outcome) => ({ outcome, total: codes.filter((code) => code === outcome).length }),
    ),
    lastAttemptAt: attempts[0]?.occurredAt ?? null,
  }
}

let historySequence = 100

/** Aplica la transición sobre el dataset, como haría el backend. */
function applyTransition(prospectId: string, body: unknown): TransitionResultApi {
  const payload = body as { toState?: OnboardingStatus; reasonCode?: string } | undefined
  const toStatus = payload?.toState
  const detail = readDetail(prospectId)

  if (!toStatus) throw new Error('Falta `toState` en la petición')
  if (!ONBOARDING_TRANSITIONS[detail.status].includes(toStatus)) {
    throw new Error(`Transición no permitida: ${detail.status} -> ${toStatus}`)
  }
  if (TRANSITIONS_REQUIRING_REASON.includes(toStatus) && !payload?.reasonCode) {
    throw new Error('Esta transición exige un motivo del catálogo')
  }

  const reason = REASONS_BY_STATUS[toStatus]?.find((item) => item.id === payload?.reasonCode)

  historySequence += 1
  const from = detail.status
  const updated: ProspectDetail = {
    ...detail,
    status: toStatus,
    daysInStatus: 0,
    history: [
      {
        id: `hst-${historySequence}`,
        fromStatus: detail.status,
        toStatus,
        changedAt: todayIso(),
        byName: OWNER_ANA.name,
        byRole: CURRENT_ROLE,
        note: reason?.label ?? TRANSITION_HINT[toStatus],
      },
      ...detail.history,
    ],
  }

  details.set(prospectId, updated)
  board = board.map((item) =>
    item.id === prospectId ? { ...item, status: toStatus, daysInStatus: 0 } : item,
  )

  return { from, to: toStatus }
}

let prospectSequence = 100
let contactSequence = 700
let hotelSequence = 100

/** Hoteles ya dados de alta que NO tienen ciclo abierto: un hotel solo tiene uno. */
const hotelsWithoutCycle: RegisteredHotel[] = [
  {
    id: 'htl-0001',
    name: 'Hotel Costa Dorada',
    zoneId: 'norte',
    zone: 'Zona Norte',
    timeZone: 'America/Cancun',
    address: 'Blvd. Kukulcán km 14, Zona Hotelera, Cancún',
    generalPhone: '+52 998 222 3344',
    location: { lat: 21.0925, lng: -86.7712 },
    geofenceMeters: 180,
  },
  {
    id: 'htl-0002',
    name: 'Posada Maya Real',
    zoneId: 'sur',
    zone: 'Zona Sur',
    timeZone: 'America/Cancun',
    address: 'Av. Tulum 320, Cancún',
    generalPhone: '+52 998 555 8899',
    location: { lat: 21.1372, lng: -86.8271 },
    geofenceMeters: 120,
  },
]

interface CreateHotelBody {
  name?: string
  zoneId?: string
  timeZone?: string
  generalPhone?: string
  geofenceRadiusM?: number
}

/** `POST /hotels`: alta del edificio, como en el contrato real (sin pin ni dirección). */
function createHotel(body: unknown): HotelApi {
  const payload = (body ?? {}) as CreateHotelBody
  const zone = ZONES.find((item) => item.id === payload.zoneId)

  if (!payload.name || !payload.timeZone) throw new Error('Faltan datos del hotel')
  if (!zone) throw new Error('La zona no existe en el catálogo')

  hotelSequence += 1
  const hotel: RegisteredHotel = {
    id: `htl-${String(hotelSequence).padStart(4, '0')}`,
    name: payload.name,
    zoneId: zone.id,
    zone: zone.label,
    timeZone: payload.timeZone,
    address: '',
    generalPhone: payload.generalPhone ?? '',
    location: null,
    geofenceMeters: payload.geofenceRadiusM ?? 0,
  }
  hotelsWithoutCycle.push(hotel)
  return registeredToHotelApi(hotel)
}

/** `PATCH /hotels/:id`: sobre un registrado o sobre el hotel de un prospecto. */
function patchHotel(hotelId: string, body: unknown): HotelApi {
  const payload = (body ?? {}) as CreateHotelBody
  const zone = payload.zoneId ? ZONES.find((item) => item.id === payload.zoneId) : null
  if (payload.zoneId && !zone) throw new Error('La zona no existe en el catálogo')

  const prospectId = prospectIdOfHotel(hotelId)
  if (prospectId) {
    const detail = readDetail(prospectId)
    const updated: ProspectDetail = {
      ...detail,
      hotelName: payload.name ?? detail.hotelName,
      hotel: {
        ...detail.hotel,
        zoneId: zone?.id ?? detail.hotel.zoneId,
        zone: zone?.label ?? detail.hotel.zone,
        timeZone: payload.timeZone ?? detail.hotel.timeZone,
        generalPhone: payload.generalPhone ?? detail.hotel.generalPhone,
        geofenceMeters: payload.geofenceRadiusM ?? detail.hotel.geofenceMeters,
      },
    }
    details.set(prospectId, updated)
    board = board.map((item) =>
      item.id === prospectId
        ? { ...item, hotelName: updated.hotelName, zone: updated.hotel.zone }
        : item,
    )
    return toHotelApi(updated)
  }

  const hotel = hotelsWithoutCycle.find((item) => item.id === hotelId)
  if (!hotel) throw new Error(`No existe el hotel ${hotelId}`)
  hotel.name = payload.name ?? hotel.name
  hotel.timeZone = payload.timeZone ?? hotel.timeZone
  hotel.generalPhone = payload.generalPhone ?? hotel.generalPhone
  hotel.geofenceMeters = payload.geofenceRadiusM ?? hotel.geofenceMeters
  if (zone) {
    hotel.zoneId = zone.id
    hotel.zone = zone.label
  }
  return registeredToHotelApi(hotel)
}

interface CreateContactBody {
  fullName?: string
  jobTitle?: string
  phone?: string
  email?: string
  isPrimary?: boolean
}

/**
 * `POST /hotels/:id/contacts`: un contacto por llamada, como el contrato real.
 * Marcar uno nuevo como principal desmarca al anterior (misma transacción del
 * backend). El refine del DTO: hace falta teléfono O correo.
 */
function createContact(hotelId: string, body: unknown): HotelContactApi {
  const payload = (body ?? {}) as CreateContactBody
  if (!payload.fullName?.trim()) throw new Error('full_name es obligatorio')
  if (!payload.phone && !payload.email) throw new Error('hace falta el teléfono o el correo')

  contactSequence += 1
  const contact: HotelContact = {
    id: `ctc-${String(contactSequence)}`,
    name: payload.fullName,
    role: payload.jobTitle ?? '',
    phone: payload.phone ?? '',
    email: payload.email ?? '',
    isPrimary: payload.isPrimary ?? false,
  }

  const prospectId = prospectIdOfHotel(hotelId)
  if (prospectId) {
    const detail = readDetail(prospectId)
    const previous = contact.isPrimary
      ? detail.contacts.map((item) => ({ ...item, isPrimary: false }))
      : detail.contacts
    details.set(prospectId, { ...detail, contacts: [...previous, contact] })
  }

  return toContactApi(contact, hotelId)
}

interface CreateProspectBody {
  hotelId?: string
  ownerUserId?: string
  needDescription?: string
}

/** `POST /prospects`: abre el ciclo sobre un hotel YA existente. Nace en GRAY. */
function createProspect(body: unknown): ProspectApi {
  const payload = (body ?? {}) as CreateProspectBody
  if (!payload.hotelId) throw new Error('Falta `hotelId`')

  // El hotel puede venir de los registrados o de un `POST /hotels` reciente.
  const registeredIndex = hotelsWithoutCycle.findIndex((item) => item.id === payload.hotelId)
  const registered = registeredIndex >= 0 ? hotelsWithoutCycle[registeredIndex] : null
  if (!registered) throw new Error(`No existe el hotel ${payload.hotelId}`)
  // Abrir el ciclo lo saca de la lista: ya tiene uno.
  hotelsWithoutCycle.splice(registeredIndex, 1)

  prospectSequence += 1
  const id = `psp-${String(prospectSequence).padStart(4, '0')}`
  const openedAt = todayIso()

  const summary: ProspectSummary = {
    id,
    hotelName: registered.name,
    zone: registered.zone,
    status: 'GRAY',
    daysInStatus: 0,
    lastAttempt: null,
    latestProposalVersion: null,
    owner: OWNER_ANA,
  }
  board = [summary, ...board]

  const detail: ProspectDetail = {
    id,
    hotelName: registered.name,
    status: 'GRAY',
    cycleStartedAt: openedAt,
    daysInStatus: 0,
    owner: OWNER_ANA,
    hotel: {
      address: registered.address,
      generalPhone: registered.generalPhone,
      zoneId: registered.zoneId,
      zone: registered.zone,
      timeZone: registered.timeZone,
      geofenceMeters: registered.geofenceMeters,
      location: registered.location,
      activatedAsClientAt: null,
    },
    needDescription: payload.needDescription ?? '',
    contacts: [],
    attempts: [],
    history: [
      {
        id: `hst-${id}-1`,
        fromStatus: null,
        toStatus: 'GRAY',
        changedAt: openedAt,
        byName: OWNER_ANA.name,
        byRole: CURRENT_ROLE,
        note: ONBOARDING_STATUS_DESCRIPTION.GRAY,
      },
    ],
  }
  details.set(id, detail)

  return toProspectApi(summary)
}

let attemptSequence = 500

interface CreateAttemptBody {
  attemptType?: ContactAttemptType
  outcome?: ContactAttemptOutcome
  occurredAt?: string
  hotelContactId?: string
  notes?: string
}

/** Alta de un intento de contacto, con las validaciones que haría el backend. */
function addContactAttempt(prospectId: string, body: unknown): ContactAttemptApi {
  const payload = (body ?? {}) as CreateAttemptBody
  const detail = readDetail(prospectId)

  if (!payload.attemptType || !payload.outcome) {
    throw new Error('Faltan campos obligatorios del intento')
  }
  if (
    payload.hotelContactId &&
    !detail.contacts.some((contact) => contact.id === payload.hotelContactId)
  ) {
    throw new Error('El contacto no pertenece a este hotel')
  }

  attemptSequence += 1
  const attempt: ContactAttempt = {
    id: `att-${attemptSequence}`,
    occurredAt: payload.occurredAt ?? todayIso(),
    channel: CONTACT_ATTEMPT_TYPE_LABEL[payload.attemptType],
    outcome: CONTACT_ATTEMPT_OUTCOME_LABEL[payload.outcome],
    byName: OWNER_ANA.name,
  }

  details.set(prospectId, {
    ...detail,
    // Se reordena en vez de solo anteponer: se puede registrar un intento viejo.
    attempts: [attempt, ...detail.attempts].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt),
    ),
  })

  board = board.map((item) =>
    item.id === prospectId
      ? { ...item, lastAttempt: { channel: attempt.channel, outcome: attempt.outcome } }
      : item,
  )

  return toAttemptApi(attempt)
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/prospects',
    resolve: ({ search }): PaginatedEnvelope<ProspectApi, ProspectBoardMeta> => {
      const zoneId = search.get('zoneId')
      const ownerUserId = search.get('ownerUserId')

      const items = board.filter((item) => {
        if (zoneId && zoneIdFromLabel(item.zone) !== zoneId) return false
        if (ownerUserId && item.owner.id !== ownerUserId) return false
        return true
      })

      /**
       * `total` NO se deriva de `items`: es el total del pipeline del usuario,
       * mientras que `items` es la página que se pinta. Por eso el encabezado
       * dice 38 y en el tablero se ven menos tarjetas.
       */
      return {
        data: items.map(toProspectApi),
        meta: {
          page: 1,
          limit: 100,
          total: 38,
          totalPages: 1,
          byState: STATE_ORDER.map((code) => ({
            code,
            total: items.filter((item) => item.status === code).length,
          })),
        },
      }
    },
  },
  {
    method: 'POST',
    path: '/prospects',
    resolve: ({ body }): ApiEnvelope<ProspectApi> => ({ data: createProspect(body) }),
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId',
    resolve: ({ params }): ApiEnvelope<ProspectApi> => {
      const prospectId = requireParam(params, 'prospectId')
      const summary = board.find((item) => item.id === prospectId)
      if (!summary) throw new Error(`No existe el prospecto ${prospectId}`)
      return { data: toProspectApi(summary) }
    },
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId/transitions',
    resolve: ({ params }): ApiEnvelope<TransitionOptionApi[]> => ({
      data: buildTransitionOptions(readDetail(requireParam(params, 'prospectId')).status),
    }),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/transitions',
    resolve: ({ params, body }): ApiEnvelope<TransitionResultApi> => ({
      data: applyTransition(requireParam(params, 'prospectId'), body),
    }),
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId/history',
    resolve: ({ params }): ApiEnvelope<HistoryEntryApi[]> => ({
      data: readDetail(requireParam(params, 'prospectId')).history.map(toHistoryApi),
    }),
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId/contact-attempts',
    resolve: ({ params }): { data: ContactAttemptApi[]; meta: AttemptSummaryApi } => {
      const detail = readDetail(requireParam(params, 'prospectId'))
      return { data: detail.attempts.map(toAttemptApi), meta: buildAttemptSummary(detail.attempts) }
    },
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/contact-attempts',
    resolve: ({ params, body }): ApiEnvelope<ContactAttemptApi> => ({
      data: addContactAttempt(requireParam(params, 'prospectId'), body),
    }),
  },
  {
    method: 'GET',
    path: '/hotels',
    resolve: (): PaginatedEnvelope<HotelApi> => ({
      data: hotelsWithoutCycle.map(registeredToHotelApi),
      meta: { page: 1, limit: 100, total: hotelsWithoutCycle.length, totalPages: 1 },
    }),
  },
  {
    method: 'POST',
    path: '/hotels',
    resolve: ({ body }): ApiEnvelope<HotelApi> => ({ data: createHotel(body) }),
  },
  {
    method: 'GET',
    path: '/hotels/:hotelId',
    resolve: ({ params }): ApiEnvelope<HotelApi> => {
      const hotelId = requireParam(params, 'hotelId')
      const prospectId = prospectIdOfHotel(hotelId)
      if (prospectId) return { data: toHotelApi(readDetail(prospectId)) }
      const hotel = hotelsWithoutCycle.find((item) => item.id === hotelId)
      if (!hotel) throw new Error(`No existe el hotel ${hotelId}`)
      return { data: registeredToHotelApi(hotel) }
    },
  },
  {
    method: 'PATCH',
    path: '/hotels/:hotelId',
    resolve: ({ params, body }): ApiEnvelope<HotelApi> => ({
      data: patchHotel(requireParam(params, 'hotelId'), body),
    }),
  },
  {
    method: 'GET',
    path: '/hotels/:hotelId/contacts',
    resolve: ({ params }): ApiEnvelope<HotelContactApi[]> => {
      const hotelId = requireParam(params, 'hotelId')
      const prospectId = prospectIdOfHotel(hotelId)
      const contacts = prospectId ? readDetail(prospectId).contacts : []
      return { data: contacts.map((contact) => toContactApi(contact, hotelId)) }
    },
  },
  {
    method: 'POST',
    path: '/hotels/:hotelId/contacts',
    resolve: ({ params, body }): ApiEnvelope<HotelContactApi> => ({
      data: createContact(requireParam(params, 'hotelId'), body),
    }),
  },
  /**
   * ⚠ Endpoints que la API real AÚN NO tiene (huecos del contrato). Conservan
   * sus tipos de vista sin envoltura porque sus endpoints del front tampoco
   * adaptan nada todavía.
   */
  {
    method: 'GET',
    path: '/catalogs/zones',
    resolve: (): Zone[] => ZONES,
  },
  {
    method: 'GET',
    path: '/catalogs/status-change-reasons',
    resolve: ({ search }): StatusChangeReason[] => {
      const toStatus = search.get('toStatus') as OnboardingStatus | null
      return toStatus ? (REASONS_BY_STATUS[toStatus] ?? []) : []
    },
  },
]

let areRoutesRegistered = false

export function registerOnboardingMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
