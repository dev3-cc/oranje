import type {
  ConversionCandidate,
  ConversionReadiness,
  ConversionRequirement,
} from '../types/conversion.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures de la conversión. ANDAMIO TEMPORAL — se borra cuando `apps/api`
 * exponga los endpoints.
 *
 * ⚠ Estado propio, separado del de Onboarding. §4 impide que una feature
 * importe de otra, así que aquí se repiten los hoteles. Consecuencia en modo
 * mock: aprobar una conversión NO mueve la tarjeta del tablero, porque son dos
 * almacenes en memoria distintos. Contra la API real es una sola transacción y
 * la invalidación del tag `Prospect` basta.
 */

/** Lo que ocurre al aprobar. Lo describe el backend porque es lo que él hace. */
const EFFECTS = [
  'prospect.onboarding_state_id pasa a ORANGE',
  'Se escribe una fila en prospect_state_history',
  'hotel.activated_at toma la fecha de hoy',
  'El hotel entra en vw_client y puede generar requisiciones',
  'Reclutamiento e Inspección toman la operación',
]

const APPROVAL_NOTE = 'solo el BDC aprueba esta transición (RR-V-01, RR-V-02)'

interface StoredConversion {
  hotelName: string
  zone: string
  daysInStatus: number
  hasHotelUser: boolean
  requirements: Omit<ConversionRequirement, 'action'>[]
  /** Al aprobar deja de ser candidato: ya es cliente activo. */
  isConverted: boolean
}

const conversions = new Map<string, StoredConversion>([
  [
    'psp-0007',
    {
      hotelName: 'Hotel Puerto Real',
      zone: 'Zona Centro',
      daysInStatus: 7,
      hasHotelUser: false,
      isConverted: false,
      requirements: [
        {
          id: 'req-proposal',
          label: 'Propuesta enviada y aceptada',
          detail: 'Propuesta v2 · 03 jun 2026',
          isMet: true,
        },
        {
          id: 'req-terms',
          label: 'Documento de T&C validado',
          detail: 'Negociado en Rosa desde el 18 jun',
          isMet: true,
        },
        {
          id: 'req-contact',
          label: 'Contacto principal registrado',
          detail: 'Marta Solís · Gerente de Compras',
          isMet: true,
        },
      ],
    },
  ],
  [
    'psp-0012',
    {
      hotelName: 'Hotel Vista Laguna',
      zone: 'Zona Norte',
      daysInStatus: 12,
      hasHotelUser: true,
      isConverted: false,
      requirements: [
        {
          id: 'req-proposal',
          label: 'Propuesta enviada y aceptada',
          detail: 'Propuesta v2 · 24 jun 2026',
          isMet: true,
        },
        {
          id: 'req-terms',
          label: 'Documento de T&C validado',
          detail: 'Negociado en Rosa desde el 02 jul',
          isMet: true,
        },
        {
          id: 'req-contact',
          label: 'Contacto principal registrado',
          detail: 'Jorge Peña · Ama de Llaves',
          isMet: true,
        },
      ],
    },
  ],
])

/** El usuario del hotel es un requisito más, pero con acción para resolverlo. */
function hotelUserRequirement(stored: StoredConversion): ConversionRequirement {
  return {
    id: 'req-hotel-user',
    label: 'Usuario del Hotel creado',
    detail: stored.hasHotelUser
      ? 'Creado desde el contacto principal'
      : 'No existe todavía — bloquea la conversión',
    isMet: stored.hasHotelUser,
    action: stored.hasHotelUser ? null : { kind: 'CREATE_HOTEL_USER', label: 'Crear usuario' },
  }
}

function readReadiness(prospectId: string): ConversionReadiness {
  const stored = conversions.get(prospectId)
  if (!stored) throw new Error(`El prospecto ${prospectId} no está en conversión`)

  const requirements: ConversionRequirement[] = [
    ...stored.requirements.map((requirement) => ({ ...requirement, action: null })),
    hotelUserRequirement(stored),
  ]
  const pending = requirements.filter((requirement) => !requirement.isMet)

  return {
    prospectId,
    hotelName: stored.hotelName,
    currentStatus: stored.isConverted ? 'NARANJA' : 'ROSA',
    targetStatus: 'NARANJA',
    approvalNote: APPROVAL_NOTE,
    requirements,
    effects: EFFECTS,
    canApprove: pending.length === 0 && !stored.isConverted,
    blockedReason: stored.isConverted
      ? 'Este hotel ya es cliente activo.'
      : pending.length > 0
        ? `Faltan ${String(pending.length)} requisitos por cumplir.`
        : null,
  }
}

function createHotelUser(prospectId: string): ConversionReadiness {
  const stored = conversions.get(prospectId)
  if (!stored) throw new Error(`El prospecto ${prospectId} no está en conversión`)
  if (stored.hasHotelUser) throw new Error('El usuario del hotel ya existe')

  stored.hasHotelUser = true
  return readReadiness(prospectId)
}

function approve(prospectId: string): ConversionReadiness {
  const readiness = readReadiness(prospectId)
  if (!readiness.canApprove) throw new Error(readiness.blockedReason ?? 'No se puede aprobar')

  const stored = conversions.get(prospectId)
  if (stored) stored.isConverted = true

  return readReadiness(prospectId)
}

function returnToRenegotiation(prospectId: string): ConversionReadiness {
  const stored = conversions.get(prospectId)
  if (!stored) throw new Error(`El prospecto ${prospectId} no está en conversión`)
  if (stored.isConverted) throw new Error('Un cliente activo ya no vuelve a Café')

  // Sale de la cola: deja de estar en Rosa esperando aprobación.
  conversions.delete(prospectId)

  return {
    prospectId,
    hotelName: stored.hotelName,
    currentStatus: 'CAFE',
    targetStatus: 'NARANJA',
    approvalNote: APPROVAL_NOTE,
    requirements: [],
    effects: EFFECTS,
    canApprove: false,
    blockedReason: 'El ciclo volvió a Café: hay que renegociar antes de convertir.',
  }
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/conversion',
    resolve: (): ConversionCandidate[] =>
      [...conversions.entries()]
        .filter(([, stored]) => !stored.isConverted)
        .map(([prospectId, stored]) => ({
          prospectId,
          hotelName: stored.hotelName,
          zone: stored.zone,
          status: 'ROSA' as const,
          daysInStatus: stored.daysInStatus,
          pendingRequirements: readReadiness(prospectId).requirements.filter(
            (requirement) => !requirement.isMet,
          ).length,
        })),
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId/conversion',
    resolve: ({ params }): ConversionReadiness => readReadiness(params.prospectId ?? ''),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/hotel-user',
    resolve: ({ params }): ConversionReadiness => createHotelUser(params.prospectId ?? ''),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/conversion/approvals',
    resolve: ({ params }): ConversionReadiness => approve(params.prospectId ?? ''),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/conversion/returns',
    resolve: ({ params }): ConversionReadiness => returnToRenegotiation(params.prospectId ?? ''),
  },
]

let areRoutesRegistered = false

export function registerConversionMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
