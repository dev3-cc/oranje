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
  CatalogItemApi,
  ReasonItemApi,
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

const OWNER_ANA = { id: 'usr-ana-ruiz', name: 'Ana Ruiz', shortName: 'A. Ruiz' }

const CURRENT_ROLE: string = 'BD'

const BDC_ONLY_TRANSITIONS: readonly OnboardingStatus[] = ['ORANGE']

const TRANSITIONS_REQUIRING_REASON: readonly OnboardingStatus[] = ['RED', 'BROWN', 'BLACK']

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

const ZONES: Zone[] = [
  { id: 'norte', label: 'Zona Norte' },
  { id: 'centro', label: 'Zona Centro' },
  { id: 'sur', label: 'Zona Sur' },
  { id: 'poniente', label: 'Zona Poniente' },
]

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

let board: ProspectSummary[] = [
  {
    id: 'psp-0001',
    hotelName: 'Hotel Riviera Maya',
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
    zone: 'Zona Centro',
    status: 'GREEN',
    daysInStatus: 5,
    lastAttempt: { channel: 'Correo', outcome: 'Interesado' },
    latestProposalVersion: 3,
    latestProposalIsDraft: true,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0009',
    hotelName: 'Resort Isla Blanca',
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
    zone: 'Zona Poniente',
    status: 'YELLOW',
    daysInStatus: 15,
    lastAttempt: { channel: 'Correo', outcome: 'Sin respuesta' },
    latestProposalVersion: 1,
    owner: OWNER_ANA,
  },
  {
    id: 'psp-0012',
    hotelName: 'Hotel Puerto Real',
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
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
    photoUrl: null,
    zone: 'Zona Norte',
    status: 'ORANGE',
    daysInStatus: 285,
    lastAttempt: { channel: 'Visita', outcome: 'Contrato firmado' },
    latestProposalVersion: 1,
    owner: OWNER_ANA,
  },
]

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
        photoUrl: null,
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
          userId: 'usr-lucia',
          typeCode: 'Reunión',
          outcomeCode: 'En revisión',
          notes: '',
          contactId: null,
        },
        {
          id: 'att-3',
          occurredAt: '2026-06-02T09:15:00',
          channel: 'Llamada',
          outcome: 'Interesado',
          byName: 'Ana Ruiz',
          userId: 'usr-ana-ruiz',
          typeCode: 'CALL',
          outcomeCode: 'INTERESTED',
          notes: '',
          contactId: null,
        },
        {
          id: 'att-2',
          occurredAt: '2026-05-21T16:40:00',
          channel: 'Correo',
          outcome: 'Interesado',
          byName: 'Ana Ruiz',
          userId: 'usr-ana-ruiz',
          typeCode: 'EMAIL',
          outcomeCode: 'INTERESTED',
          notes: '',
          contactId: null,
        },
        {
          id: 'att-1',
          occurredAt: '2026-05-12T10:00:00',
          channel: 'Visita en frío',
          outcome: 'Cita agendada',
          byName: 'Ana Ruiz',
          userId: 'usr-ana-ruiz',
          typeCode: 'COLD_VISIT',
          outcomeCode: 'MEETING_SET',
          notes: '',
          contactId: null,
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

function requireParam(params: Readonly<Record<string, string>>, name: string): string {
  const value = params[name]
  if (!value) throw new Error(`Falta el parámetro de ruta ${name}`)
  return value
}

const CONVERSION_PATH: readonly OnboardingStatus[] = [
  'GRAY',
  'LIGHT_BLUE',
  'GREEN',
  'YELLOW',
  'PINK',
  'ORANGE',
]

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
      photoUrl: null,
      activatedAsClientAt: summary.status === 'ORANGE' ? cycleStartedAt : null,
    },
    contacts: [],
    attempts: [],
    history: buildHistory(summary, cycleStartedAt),
  }
}

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
      photoUrl: detail.hotel.photoUrl,
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
    lastAttempt: summary.lastAttempt
      ? {
          occurredAt: detail.attempts[0]?.occurredAt ?? isoDaysAgo(summary.daysInStatus),
          attemptType: codeForLabel(summary.lastAttempt.channel, CONTACT_ATTEMPT_TYPE_LABEL),
          outcome: codeForLabel(summary.lastAttempt.outcome, CONTACT_ATTEMPT_OUTCOME_LABEL),
        }
      : null,
    lastProposal: summary.latestProposalVersion
      ? {
          version: summary.latestProposalVersion,
          isDraft: summary.latestProposalIsDraft ?? false,
          sentAt: summary.latestProposalIsDraft ? null : isoDaysAgo(summary.daysInStatus),
        }
      : null,
  }
}

function toHotelApi(detail: ProspectDetail): HotelApi {
  return {
    id: hotelIdOf(detail.id),
    name: detail.hotelName,
    generalPhone: detail.hotel.generalPhone || null,
    timeZone: detail.hotel.timeZone,
    geofenceRadiusM: detail.hotel.geofenceMeters || null,
    address: detail.hotel.address || null,
    placeId: null,
    photoUrl: detail.hotel.photoUrl ?? null,
    latitude: detail.hotel.location?.lat ?? null,
    longitude: detail.hotel.location?.lng ?? null,
    zone: zoneRef(detail.hotel.zoneId),
    isClient: detail.hotel.activatedAsClientAt !== null,
    activatedAt: detail.hotel.activatedAsClientAt,
    contactCount: detail.contacts.length,
    createdAt: detail.cycleStartedAt,
    updatedAt: null,
  }
}

const CLIENT_WITHOUT_CONTRACT_ID = 'htl-0002'

function registeredToHotelApi(hotel: RegisteredHotel): HotelApi {
  const isClient = hotel.id === CLIENT_WITHOUT_CONTRACT_ID
  return {
    id: hotel.id,
    name: hotel.name,
    generalPhone: hotel.generalPhone || null,
    timeZone: hotel.timeZone,
    geofenceRadiusM: hotel.geofenceMeters || null,
    address: hotel.address || null,
    placeId: null,
    photoUrl: hotel.photoUrl ?? null,
    latitude: hotel.location?.lat ?? null,
    longitude: hotel.location?.lng ?? null,
    zone: zoneRef(hotel.zoneId),
    isClient,
    activatedAt: isClient ? isoDaysAgo(21) : null,
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

function codeForLabel(label: string, catalog: Record<string, string>): string {
  const found = Object.entries(catalog).find(([, itemLabel]) => itemLabel === label)
  return found ? found[0] : label
}

function toAttemptApi(attempt: ContactAttempt): ContactAttemptApi {
  return {
    id: attempt.id,
    attemptType: attempt.typeCode || codeForLabel(attempt.channel, CONTACT_ATTEMPT_TYPE_LABEL),
    outcome: attempt.outcomeCode || codeForLabel(attempt.outcome, CONTACT_ATTEMPT_OUTCOME_LABEL),
    contact: null,
    user: { id: attempt.userId, fullName: attempt.byName },
    occurredAt: attempt.occurredAt,
    notes: attempt.notes || null,
  }
}

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
    photoUrl: null,
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
    photoUrl: null,
    geofenceMeters: 120,
  },
]

interface CreateHotelBody {
  name?: string
  zoneId?: string
  timeZone?: string
  generalPhone?: string
  geofenceRadiusM?: number
  address?: string
  photoUrl?: string
  latitude?: number
  longitude?: number
}

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
    address: payload.address ?? '',
    photoUrl: payload.photoUrl ?? null,
    generalPhone: payload.generalPhone ?? '',
    location:
      payload.latitude !== undefined && payload.longitude !== undefined
        ? { lat: payload.latitude, lng: payload.longitude }
        : null,
    geofenceMeters: payload.geofenceRadiusM ?? 0,
  }
  hotelsWithoutCycle.push(hotel)
  return registeredToHotelApi(hotel)
}

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
        address: payload.address ?? detail.hotel.address,
        photoUrl: payload.photoUrl ?? detail.hotel.photoUrl,
        location:
          payload.latitude !== undefined && payload.longitude !== undefined
            ? { lat: payload.latitude, lng: payload.longitude }
            : detail.hotel.location,
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

function createProspect(body: unknown): ProspectApi {
  const payload = (body ?? {}) as CreateProspectBody
  if (!payload.hotelId) throw new Error('Falta `hotelId`')

  const registeredIndex = hotelsWithoutCycle.findIndex((item) => item.id === payload.hotelId)
  const registered = registeredIndex >= 0 ? hotelsWithoutCycle[registeredIndex] : null
  if (!registered) throw new Error(`No existe el hotel ${payload.hotelId}`)
  hotelsWithoutCycle.splice(registeredIndex, 1)

  prospectSequence += 1
  const id = `psp-${String(prospectSequence).padStart(4, '0')}`
  const openedAt = todayIso()

  const summary: ProspectSummary = {
    id,
    hotelName: registered.name,
    photoUrl: null,
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
      photoUrl: registered.photoUrl ?? null,
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
    userId: OWNER_ANA.id,
    typeCode: payload.attemptType,
    outcomeCode: payload.outcome,
    notes: payload.notes ?? '',
    contactId: payload.hotelContactId ?? null,
  }

  details.set(prospectId, {
    ...detail,
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

      const state = search.get('state')

      const items = board.filter((item) => {
        if (zoneId && zoneIdFromLabel(item.zone) !== zoneId) return false
        if (ownerUserId && item.owner.id !== ownerUserId) return false
        if (state && item.status !== state) return false
        return true
      })

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
    method: 'PATCH',
    path: '/prospects/:prospectId',
    resolve: ({ params, body }): ApiEnvelope<ProspectApi> => {
      const prospectId = requireParam(params, 'prospectId')
      const payload = (body ?? {}) as { ownerUserId?: string; needDescription?: string | null }
      const detail = readDetail(prospectId)
      details.set(prospectId, {
        ...detail,
        needDescription:
          payload.needDescription !== undefined
            ? (payload.needDescription ?? '')
            : detail.needDescription,
      })
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
    method: 'POST',
    path: '/prospects/:prospectId/close',
    /** El mock solo confirma: la lista con `includeClosed` no distingue fixtures cerrados. */
    resolve: (): { data: null } => ({ data: null }),
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
    method: 'PATCH',
    path: '/prospects/:prospectId/contact-attempts/:attemptId',
    resolve: ({ params, body }): ApiEnvelope<ContactAttemptApi> => {
      const prospectId = requireParam(params, 'prospectId')
      const attemptId = requireParam(params, 'attemptId')
      const payload = (body ?? {}) as Partial<CreateAttemptBody> & { notes?: string | null }
      const detail = readDetail(prospectId)
      const attempt = detail.attempts.find((item) => item.id === attemptId)
      if (!attempt) throw new Error('El intento no existe')

      const updated: ContactAttempt = {
        ...attempt,
        ...(payload.attemptType
          ? {
              typeCode: payload.attemptType,
              channel: CONTACT_ATTEMPT_TYPE_LABEL[payload.attemptType],
            }
          : {}),
        ...(payload.outcome
          ? {
              outcomeCode: payload.outcome,
              outcome: CONTACT_ATTEMPT_OUTCOME_LABEL[payload.outcome],
            }
          : {}),
        ...(payload.occurredAt ? { occurredAt: payload.occurredAt } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes ?? '' } : {}),
        ...(payload.hotelContactId !== undefined
          ? { contactId: payload.hotelContactId ?? null }
          : {}),
      }
      details.set(prospectId, {
        ...detail,
        attempts: detail.attempts
          .map((item) => (item.id === attemptId ? updated : item))
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
      })
      return { data: toAttemptApi(updated) }
    },
  },
  {
    method: 'DELETE',
    path: '/prospects/:prospectId/contact-attempts/:attemptId',
    resolve: ({ params }): null => {
      const prospectId = requireParam(params, 'prospectId')
      const attemptId = requireParam(params, 'attemptId')
      const detail = readDetail(prospectId)
      details.set(prospectId, {
        ...detail,
        attempts: detail.attempts.filter((item) => item.id !== attemptId),
      })
      return null
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
    resolve: (): PaginatedEnvelope<HotelApi> => {
      const data = [
        ...board.map((summary) => toHotelApi(readDetail(summary.id))),
        ...hotelsWithoutCycle.map(registeredToHotelApi),
      ]
      return { data, meta: { page: 1, limit: 100, total: data.length, totalPages: 1 } }
    },
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
  {
    method: 'GET',
    path: '/catalogs/zones',
    resolve: (): ApiEnvelope<CatalogItemApi[]> => ({
      data: ZONES.map((zone) => ({ id: zone.id, code: zone.id.toUpperCase(), name: zone.label })),
    }),
  },
  {
    method: 'GET',
    path: '/catalogs/reasons',
    resolve: (): ApiEnvelope<ReasonItemApi[]> => ({
      data: Object.values(REASONS_BY_STATUS)
        .flat()
        .map((reason) => ({
          id: reason.id,
          code: reason.id,
          name: reason.label,
          statusLight: 'ONBOARDING',
        })),
    }),
  },
]

let areRoutesRegistered = false

export function registerOnboardingMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
