import type {
  ConversionCandidate,
  ConversionReadiness,
  ConversionRequirement,
} from '../types/conversion.types'

import { registerConversionMocks } from './conversionMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import { IS_DEV_UI } from '@/shared/lib/devMode'
import { formatDayMonth } from '@/shared/lib/formatters'
import type {
  ApiEnvelope,
  HotelContactApi,
  PaginatedEnvelope,
  ProposalApi,
  ProspectApi,
} from '@/shared/types/apiContract.types'

registerConversionMocks()

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

interface HotelUserApi {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string }
}

const APPROVAL_NOTE = IS_DEV_UI
  ? 'solo el BDC aprueba esta transición (RR-V-01, RR-V-02)'
  : 'solo el BDC aprueba esta transición'

function buildEffects(): string[] {
  const effects: Array<[string, string]> = [
    ['El semáforo pasa a Naranja', 'prospect.onboarding_state_id → ORANGE'],
    ['El cambio queda en el historial del prospecto', 'prospect_state_history'],
    ['El hotel queda activado como cliente desde hoy', 'hotel.activated_at'],
    ['El hotel ya puede generar requisiciones', 'entra en vw_client'],
    ['Reclutamiento e Inspección toman la operación', ''],
  ]
  return effects.map(([human, tech]) => (IS_DEV_UI && tech ? `${human} · ${tech}` : human))
}

async function fetchReadiness(
  fetchWithBQ: FetchWithBQ,
  prospectId: string,
): Promise<{ data: ConversionReadiness } | { error: unknown }> {
  const prospectRes = await fetchWithBQ(`/prospects/${prospectId}`)
  if (prospectRes.error) return { error: prospectRes.error }
  const prospect = (prospectRes.data as ApiEnvelope<ProspectApi>).data

  if (prospect.state.code !== 'PINK') {
    return {
      error: {
        status: 409,
        data: {
          error: {
            code: 'NOT_AWAITING_CONVERSION',
            message: 'La conversión sale de Rosa: este prospecto está en otro estado',
            state: prospect.state.code,
          },
        },
      },
    }
  }

  const hotelId = prospect.hotel.id
  const [proposalsRes, contactsRes, usersRes] = await Promise.all([
    fetchWithBQ(`/prospects/${prospectId}/proposals`),
    fetchWithBQ(`/hotels/${hotelId}/contacts`),
    fetchWithBQ(`/hotels/${hotelId}/users`),
  ])
  if (proposalsRes.error) return { error: proposalsRes.error }
  if (contactsRes.error) return { error: contactsRes.error }
  if (usersRes.error) return { error: usersRes.error }

  const proposals = (proposalsRes.data as ApiEnvelope<ProposalApi[]>).data
  const contacts = (contactsRes.data as ApiEnvelope<HotelContactApi[]>).data
  const users = (usersRes.data as ApiEnvelope<HotelUserApi[]>).data

  const sentProposal = proposals
    .filter((proposal) => !proposal.isDraft && proposal.sentAt !== null)
    .sort((a, b) => b.version - a.version)[0]
  const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0]
  const hotelUser = users[0]

  const requirements: ConversionRequirement[] = [
    {
      id: 'proposal-sent',
      label: 'Propuesta enviada',
      detail: sentProposal
        ? `Propuesta v${String(sentProposal.version)} · ${formatDayMonth(sentProposal.sentAt as string)}`
        : `Sin propuesta enviada — se elabora y envía en Verde${IS_DEV_UI ? ' (D-22)' : ''}`,
      isMet: sentProposal !== undefined,
      action: null,
    },
    {
      id: 'terms-negotiated',
      label: 'Documento de T&C negociado',
      detail: 'Se negocia en Rosa — el sistema aún no lo registra (pendiente de modelar)',
      isMet: true,
      action: null,
    },
    {
      id: 'primary-contact',
      label: 'Contacto principal registrado',
      detail: primaryContact
        ? `${primaryContact.fullName}${primaryContact.jobTitle ? ` · ${primaryContact.jobTitle}` : ''}`
        : 'Sin contacto registrado — agrégalo en la ficha del prospecto',
      isMet: primaryContact !== undefined,
      action: null,
    },
    {
      id: 'hotel-user',
      label: 'Usuario del Hotel creado',
      detail: hotelUser
        ? `${hotelUser.fullName} · ${hotelUser.role.name}`
        : primaryContact?.email
          ? `No existe todavía — bloquea la conversión${IS_DEV_UI ? ' (RR-V-02)' : ''}`
          : 'No existe, y el contacto principal no tiene correo: agrégaselo para poder crearlo',
      isMet: hotelUser !== undefined,
      action:
        !hotelUser && primaryContact?.email
          ? { kind: 'CREATE_HOTEL_USER', label: 'Crear usuario' }
          : null,
    },
  ]

  const canApprove = hotelUser !== undefined
  return {
    data: {
      prospectId,
      hotelId,
      hotelName: prospect.hotel.name,
      currentStatus: 'PINK',
      targetStatus: 'ORANGE',
      approvalNote: APPROVAL_NOTE,
      requirements,
      effects: buildEffects(),
      canApprove,
      blockedReason: canApprove
        ? null
        : `Falta el Usuario del Hotel: sin él no se puede aprobar${IS_DEV_UI ? ' (HOTEL_USER_REQUIRED)' : ''}`,
      hotelUserDraft: primaryContact?.email
        ? { email: primaryContact.email, fullName: primaryContact.fullName }
        : null,
    },
  }
}

async function fetchQueue(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: ConversionCandidate[] } | { error: unknown }> {
  const listRes = await fetchWithBQ({ url: '/prospects', params: { state: 'PINK', limit: 100 } })
  if (listRes.error) return { error: listRes.error }
  const prospects = (listRes.data as PaginatedEnvelope<ProspectApi>).data

  const candidates = await Promise.all(
    prospects.map(async (prospect): Promise<ConversionCandidate> => {
      const usersRes = await fetchWithBQ(`/hotels/${prospect.hotel.id}/users`)
      const hasUser =
        !usersRes.error && (usersRes.data as ApiEnvelope<HotelUserApi[]>).data.length > 0
      return {
        prospectId: prospect.id,
        hotelName: prospect.hotel.name,
        zone: prospect.hotel.zone.name,
        status: prospect.state.code as OnboardingStatus,
        daysInStatus: Math.max(
          0,
          Math.floor((Date.now() - new Date(prospect.stateSince).getTime()) / 86_400_000),
        ),
        pendingRequirements: hasUser ? 0 : 1,
      }
    }),
  )
  return { data: candidates }
}

export const conversionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getConversionQueue: build.query<ConversionCandidate[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchQueue(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    getConversionReadiness: build.query<ConversionReadiness, string>({
      queryFn: async (prospectId, _api, _extra, fetchWithBQ) => {
        const result = await fetchReadiness(fetchWithBQ as FetchWithBQ, prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    createHotelUser: build.mutation<
      unknown,
      { prospectId: string; hotelId: string; email: string; fullName: string }
    >({
      query: ({ hotelId, email, fullName }) => ({
        url: `/hotels/${hotelId}/users`,
        method: 'POST',
        body: { email, fullName, roleCode: 'ROL-H-03' },
      }),
      invalidatesTags: (_result, _error, { prospectId }) => [{ type: 'Prospect', id: prospectId }],
    }),

    approveConversion: build.mutation<unknown, string>({
      query: (prospectId) => ({
        url: `/prospects/${prospectId}/transitions`,
        method: 'POST',
        body: { toState: 'ORANGE' },
      }),
      invalidatesTags: (_result, _error, prospectId) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
        { type: 'Hotel', id: 'LIST' },
      ],
    }),

    returnToRenegotiation: build.mutation<unknown, { prospectId: string; reasonCode: string }>({
      query: ({ prospectId, reasonCode }) => ({
        url: `/prospects/${prospectId}/transitions`,
        method: 'POST',
        body: { toState: 'BROWN', reasonCode },
      }),
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetConversionQueueQuery,
  useGetConversionReadinessQuery,
  useCreateHotelUserMutation,
  useApproveConversionMutation,
  useReturnToRenegotiationMutation,
} = conversionApi
