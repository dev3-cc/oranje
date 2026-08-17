import type {
  AllowedTransition,
  AllowedTransitions,
  ContactAttempt,
  CreateProspectRequest,
  HotelContact,
  HotelContactPayload,
  HotelData,
  HotelPayload,
  PipelineBoard,
  ProspectDetail,
  ProspectSummary,
  RegisteredHotel,
  StatusChangeReason,
  StatusHistoryEntry,
  UpdateProspectRequest,
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
  ONBOARDING_TRANSITIONS,
  type OnboardingStatus,
} from '@/shared/constants/onboardingStatus'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { GeoPoint } from '@/shared/types/geo.types'

/**
 * Fixtures de Onboarding. ANDAMIO TEMPORAL — se borra completo cuando
 * `apps/api` exponga los endpoints; no queda nada de esto en el front.
 *
 * Los datos reproducen las capturas del diseño al pie de la letra para poder
 * comparar pantalla contra maqueta. Los prospectos que no salen en las
 * capturas se derivan de su tarjeta, con las listas vacías: así los estados
 * «sin contactos» y «sin propuestas» también se ven en desarrollo.
 */

const OWNER_ANA = { id: 'usr-ana-ruiz', name: 'Ana Ruiz', shortName: 'A. Ruiz' }

/** Rol de la sesión simulada. En el backend sale del token, no de una constante. */
const CURRENT_ROLE: string = 'BD'

/** Transiciones que solo el BDC puede ejecutar (RBAC simulado). */
const BDC_ONLY_TRANSITIONS: readonly OnboardingStatus[] = ['ORANGE']

/** Motivo obligatorio: `requires_reason` de `catalogs.status_change_reason`. */
const TRANSITIONS_REQUIRING_REASON: readonly OnboardingStatus[] = ['RED', 'BROWN']

/** Frase corta que acompaña a cada transición en el modal. */
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

/** `catalogs.zonas`. El id es lo que se guarda; la etiqueta, lo que se pinta. */
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
   * aquí, pero NO se pintan en él: `PIPELINE_COLUMNS` deja fuera `NARANJA` por
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

function buildAllowedTransitions(status: OnboardingStatus): AllowedTransitions {
  const all = ONBOARDING_TRANSITIONS[status]
  const visible = all.filter(
    (target) => CURRENT_ROLE === 'BDC' || !BDC_ONLY_TRANSITIONS.includes(target),
  )
  const isConversionHidden = all.includes('ORANGE') && !visible.includes('ORANGE')

  const transitions: AllowedTransition[] = visible.map((target) => ({
    toStatus: target,
    title: ONBOARDING_STATUS_DESCRIPTION[target],
    description: TRANSITION_HINT[target],
    requiresReason: TRANSITIONS_REQUIRING_REASON.includes(target),
  }))

  return {
    transitions,
    restrictionNote: isConversionHidden
      ? 'La conversión a Naranja no aparece: solo el BDC aprueba la conversión a cliente activo.'
      : null,
  }
}

let historySequence = 100

/** Aplica el cambio de estado sobre el dataset, como haría el backend. */
function applyStatusChange(prospectId: string, body: unknown): ProspectDetail {
  const payload = body as { toStatus?: OnboardingStatus; reasonId?: string } | undefined
  const toStatus = payload?.toStatus
  const detail = readDetail(prospectId)

  if (!toStatus) throw new Error('Falta `toStatus` en la petición')
  if (!ONBOARDING_TRANSITIONS[detail.status].includes(toStatus)) {
    throw new Error(`Transición no permitida: ${detail.status} -> ${toStatus}`)
  }
  if (TRANSITIONS_REQUIRING_REASON.includes(toStatus) && !payload?.reasonId) {
    throw new Error('Esta transición exige un motivo del catálogo')
  }

  const reason = REASONS_BY_STATUS[toStatus]?.find((item) => item.id === payload?.reasonId)

  historySequence += 1
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

  return updated
}

let prospectSequence = 100
let contactSequence = 700

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

function readHotelPayload(body: unknown): CreateProspectRequest | undefined {
  return body as CreateProspectRequest | undefined
}

function toHotelData(hotel: HotelPayload, zone: Zone): HotelData {
  return {
    address: hotel.address,
    generalPhone: hotel.generalPhone,
    zoneId: zone.id,
    zone: zone.label,
    timeZone: hotel.timeZone,
    geofenceMeters: hotel.geofenceMeters,
    location: hotel.location,
    activatedAsClientAt: null,
  }
}

function toContact(payload: HotelContactPayload, id: string): HotelContact {
  return {
    id,
    name: payload.fullName,
    role: payload.jobTitle,
    phone: payload.phone,
    email: payload.email,
    isPrimary: payload.isPrimary,
  }
}

/**
 * Alta de varios contactos de un hotel, en UNA sola llamada.
 *
 * Es un lote y no una petición por contacto porque `ux_hotel_contact_primary`
 * —el índice único parcial sobre `hotel_id WHERE is_primary`— obliga a que
 * quitarle el principal al anterior y dárselo al nuevo ocurra en la MISMA
 * transacción. Partido en dos llamadas, el motor rechaza la segunda.
 */
function addContacts(prospectId: string, body: unknown): ProspectDetail {
  const detail = readDetail(prospectId)
  const payloads = readContactPayloads(body)

  if (payloads.length === 0) throw new Error('No hay contactos que agregar')
  if (payloads.some((payload) => payload.fullName.trim() === '')) {
    throw new Error('full_name es obligatorio')
  }

  const incoming = payloads.map((payload) => {
    contactSequence += 1
    return toContact(payload, `ctc-${String(contactSequence)}`)
  })

  const newPrimary = incoming.find((contact) => contact.isPrimary)
  const previous = newPrimary
    ? detail.contacts.map((contact) => ({ ...contact, isPrimary: false }))
    : detail.contacts

  const updated: ProspectDetail = { ...detail, contacts: [...previous, ...incoming] }
  details.set(prospectId, updated)
  return updated
}

function readContactPayloads(body: unknown): HotelContactPayload[] {
  if (typeof body !== 'object' || body === null) return []
  const contacts = (body as { contacts?: unknown }).contacts
  return Array.isArray(contacts) ? (contacts as HotelContactPayload[]) : []
}

/** Alta de un prospecto: abre el ciclo. Nace en GRIS, sin intentos. */
function createProspect(body: unknown): ProspectDetail {
  const payload = readHotelPayload(body)
  const zone = ZONES.find((item) => item.id === payload?.hotel.zoneId)

  if (!payload?.hotel.name || !payload.hotel.location) throw new Error('Faltan datos del hotel')
  if (!zone) throw new Error('La zona no existe en el catálogo')
  if (!payload.contact.fullName) throw new Error('El ciclo abre con un contacto')

  prospectSequence += 1
  contactSequence += 1
  const id = `psp-${String(prospectSequence).padStart(4, '0')}`
  const openedAt = todayIso()

  // Reusar un hotel registrado lo saca de la lista: ya tiene ciclo abierto.
  if (payload.hotelSource === 'EXISTING' && payload.existingHotelId) {
    const index = hotelsWithoutCycle.findIndex((item) => item.id === payload.existingHotelId)
    if (index >= 0) hotelsWithoutCycle.splice(index, 1)
  }

  board = [
    {
      id,
      hotelName: payload.hotel.name,
      zone: zone.label,
      status: 'GRAY',
      daysInStatus: 0,
      lastAttempt: null,
      latestProposalVersion: null,
      owner: OWNER_ANA,
    },
    ...board,
  ]

  const detail: ProspectDetail = {
    id,
    hotelName: payload.hotel.name,
    status: 'GRAY',
    cycleStartedAt: openedAt,
    daysInStatus: 0,
    owner: OWNER_ANA,
    hotel: toHotelData(payload.hotel, zone),
    needDescription: payload.needDescription,
    contacts: [toContact(payload.contact, `ctc-${String(contactSequence)}`)],
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
  return detail
}

/** Edición del prospecto. El semáforo y el historial no se tocan. */
function updateProspect(prospectId: string, body: unknown): ProspectDetail {
  const payload = body as UpdateProspectRequest | undefined
  const detail = readDetail(prospectId)
  const zone = ZONES.find((item) => item.id === payload?.hotel.zoneId)

  if (!payload?.hotel.name || !payload.hotel.location) throw new Error('Faltan datos del hotel')
  if (!zone) throw new Error('La zona no existe en el catálogo')

  // El contacto editado sustituye al principal; si no había, se agrega.
  const contacts = payload.contact
    ? [
        toContact(payload.contact, detail.contacts.find((item) => item.isPrimary)?.id ?? 'ctc-new'),
        ...detail.contacts.filter((item) => !item.isPrimary),
      ]
    : detail.contacts

  const updated: ProspectDetail = {
    ...detail,
    hotelName: payload.hotel.name,
    hotel: toHotelData(payload.hotel, zone),
    needDescription: payload.needDescription,
    contacts,
  }

  details.set(prospectId, updated)
  board = board.map((item) =>
    item.id === prospectId ? { ...item, hotelName: payload.hotel.name, zone: zone.label } : item,
  )

  return updated
}

let attemptSequence = 500

/** Alta de un intento de contacto, con las validaciones que haría el backend. */
function addContactAttempt(prospectId: string, body: unknown): ContactAttempt {
  const payload = body as
    | {
        attemptType?: ContactAttemptType
        outcome?: ContactAttemptOutcome
        occurredAt?: string
        hotelContactId?: string
      }
    | undefined

  const detail = readDetail(prospectId)

  if (!payload?.attemptType || !payload.outcome || !payload.occurredAt) {
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
    occurredAt: payload.occurredAt,
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

  return attempt
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/prospects',
    resolve: ({ search }): PipelineBoard => {
      const zone = search.get('zone')
      const ownerId = search.get('ownerId')
      const staleDays = search.get('staleDays')

      const items = board.filter((item) => {
        if (zone && item.zone !== zone) return false
        if (ownerId && item.owner.id !== ownerId) return false
        if (staleDays && item.daysInStatus < Number(staleDays)) return false
        return true
      })

      /**
       * `openCount` y `zoneCount` NO se derivan de `items`: son el total del
       * pipeline del usuario, mientras que `items` es la página que se pinta.
       * Por eso el encabezado dice 38 y en el tablero se ven menos tarjetas.
       */
      return { openCount: 38, zoneCount: 5, items }
    },
  },
  {
    method: 'POST',
    path: '/prospects',
    resolve: ({ body }): ProspectDetail => createProspect(body),
  },
  {
    method: 'GET',
    path: '/catalogs/zones',
    resolve: (): Zone[] => ZONES,
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId',
    resolve: ({ params }): ProspectDetail => readDetail(requireParam(params, 'prospectId')),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/contacts',
    resolve: ({ params, body }): ProspectDetail =>
      addContacts(requireParam(params, 'prospectId'), body),
  },
  {
    method: 'PATCH',
    path: '/prospects/:prospectId',
    resolve: ({ params, body }): ProspectDetail =>
      updateProspect(requireParam(params, 'prospectId'), body),
  },
  {
    method: 'GET',
    path: '/hotels',
    resolve: (): RegisteredHotel[] => hotelsWithoutCycle,
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId/allowed-transitions',
    resolve: ({ params }): AllowedTransitions =>
      buildAllowedTransitions(readDetail(requireParam(params, 'prospectId')).status),
  },
  {
    method: 'GET',
    path: '/catalogs/status-change-reasons',
    resolve: ({ search }): StatusChangeReason[] => {
      const toStatus = search.get('toStatus') as OnboardingStatus | null
      return toStatus ? (REASONS_BY_STATUS[toStatus] ?? []) : []
    },
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/status-changes',
    resolve: ({ params, body }): ProspectDetail =>
      applyStatusChange(requireParam(params, 'prospectId'), body),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/contact-attempts',
    resolve: ({ params, body }): ContactAttempt =>
      addContactAttempt(requireParam(params, 'prospectId'), body),
  },
]

let areRoutesRegistered = false

export function registerOnboardingMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
