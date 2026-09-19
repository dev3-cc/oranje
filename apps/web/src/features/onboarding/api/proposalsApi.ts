import type {
  ProposalCandidate,
  ProposalDraft,
  ProposalRate,
  ProposalTarget,
  ProposalVersionSummary,
  ProposalWorkspace,
  SaveProposalDraftRequest,
} from '../types/proposal.types'

import { registerProposalsMocks } from './proposalsMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type { ApiEnvelope, ProposalApi, ProspectApi } from '@/shared/types/apiContract.types'

registerProposalsMocks()

function toRate(value: string | null): number {
  return value === null ? 0 : Number(value)
}

/** El cuadro por puesto, ya en números para pintarlo y sumarlo. */
function adaptRates(proposal: ProposalApi): ProposalRate[] {
  return (proposal.rates ?? []).map((rate) => ({
    id: rate.id,
    positionId: rate.position.id,
    positionName: rate.position.name,
    payRate: Number(rate.payRate),
    billRate: Number(rate.billRate),
  }))
}

function adaptVersion(proposal: ProposalApi): ProposalVersionSummary {
  return {
    id: proposal.id,
    version: proposal.version,
    status: proposal.isDraft ? 'DRAFT' : 'SENT',
    sentAt: proposal.sentAt,
    byName: proposal.sentBy?.fullName ?? '',
    servicesNote: proposal.servicesNote ?? '',
    rates: adaptRates(proposal),
    payRate: toRate(proposal.payRate),
    billRate: toRate(proposal.billRate),
  }
}

function adaptDraft(proposal: ProposalApi): ProposalDraft {
  return {
    id: proposal.id,
    version: proposal.version,
    servicesNote: proposal.servicesNote ?? '',
    rates: adaptRates(proposal),
    payRate: toRate(proposal.payRate),
    billRate: toRate(proposal.billRate),
  }
}

type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

async function fetchWorkspace(
  fetchWithBQ: FetchWithBQ,
  prospectId: string,
): Promise<{ data: ProposalWorkspace } | { error: unknown }> {
  const [prospectRes, proposalsRes, positionsRes] = await Promise.all([
    fetchWithBQ(`/prospects/${prospectId}`),
    fetchWithBQ(`/prospects/${prospectId}/proposals`),
    /* Los puestos que el cuadro puede cotizar. Los da de alta el Administrador
       en Catálogos; si la lista falla, el formulario lo dice y no inventa. */
    fetchWithBQ('/catalogs/positions'),
  ])
  if (prospectRes.error) return { error: prospectRes.error }
  if (proposalsRes.error) return { error: proposalsRes.error }

  const prospect = (prospectRes.data as ApiEnvelope<ProspectApi>).data
  const proposals = (proposalsRes.data as ApiEnvelope<ProposalApi[]>).data
  const draft = proposals.find((proposal) => proposal.isDraft) ?? null

  /* La dirección vive en el hotel, no en el prospecto: el machote la jala de ahí. Si falla, el documento sale sin ella. */
  /* La foto del dueño vive en /team (firmada). El BD dueño recibe 403 ahí: entonces va sin foto (la ficha lo muestra con iniciales). */
  const teamRes = await fetchWithBQ('/team')
  const ownerPhotoUrl = teamRes.error
    ? null
    : ((teamRes.data as ApiEnvelope<Array<{ id: string; photoUrl: string | null }>>).data.find(
        (member) => member.id === prospect.owner.id,
      )?.photoUrl ?? null)

  const hotelRes = await fetchWithBQ(`/hotels/${prospect.hotel.id}`)
  const hotelAddress = hotelRes.error
    ? null
    : ((hotelRes.data as ApiEnvelope<{ address: string | null }>).data.address ?? null)

  /* A quién se le manda la propuesta: el contacto principal del hotel. Si no
     hay o no se puede leer, el correo se abre sin destinatario. */
  const contactsRes = await fetchWithBQ(`/hotels/${prospect.hotel.id}/contacts`)
  const contacts = contactsRes.error
    ? []
    : (contactsRes.data as ApiEnvelope<Array<{ email: string | null; isPrimary: boolean }>>).data
  const contactEmail =
    contacts.find((contact) => contact.isPrimary && contact.email)?.email ??
    contacts.find((contact) => contact.email)?.email ??
    null

  return {
    data: {
      prospectId,
      hotelName: prospect.hotel.name,
      owner: { id: prospect.owner.id, name: prospect.owner.fullName, photoUrl: ownerPhotoUrl },
      hotelAddress,
      contactEmail,
      prospectStatus: prospect.state.code as OnboardingStatus,
      draft: draft ? adaptDraft(draft) : null,
      versions: proposals.map(adaptVersion),
      positions: positionsRes.error
        ? []
        : (positionsRes.data as ApiEnvelope<Array<{ id: string; name: string }>>).data.map(
            (item) => ({ id: item.id, name: item.name }),
          ),
    },
  }
}

export const proposalsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProposalCandidates: build.query<ProposalCandidate[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        /** `/prospects` no filtra por "tiene propuesta": hay que traer TODOS para filtrar aquí. */
        const res = await fetchAllPages<ProspectApi>(fetchWithBQ as FetchWithBQ, '/prospects', {
          includeClosed: true,
        })
        if ('error' in res) return { error: res.error as never }

        const prospects = res.data
        const candidates: ProposalCandidate[] = []
        for (const prospect of prospects) {
          const last = prospect.lastProposal
          if (!last) continue
          candidates.push({
            prospectId: prospect.id,
            hotelName: prospect.hotel.name,
            hotelPhotoUrl: prospect.hotel.photoUrl,
            zone: prospect.hotel.zone.name,
            prospectStatus: prospect.state.code as OnboardingStatus,
            latestVersion: last.version,
            latestVersionStatus: last.isDraft ? 'DRAFT' : 'SENT',
            latestSentAt: last.sentAt,
          })
        }
        return { data: candidates }
      },
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    /**
     * A quién se le puede abrir una propuesta NUEVA: prospectos en Verde o
     * Café (la regla del back) que todavía no tienen ninguna. Los que ya
     * tienen versiones se siguen desde su fila de la lista.
     */
    getProposalTargets: build.query<ProposalTarget[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const res = await fetchAllPages<ProspectApi>(fetchWithBQ as FetchWithBQ, '/prospects')
        if ('error' in res) return { error: res.error as never }

        const prospects = res.data
        return {
          data: prospects
            .filter(
              (prospect) =>
                (prospect.state.code === 'GREEN' || prospect.state.code === 'BROWN') &&
                !prospect.lastProposal,
            )
            .map((prospect) => ({
              prospectId: prospect.id,
              hotelName: prospect.hotel.name,
              zone: prospect.hotel.zone.name,
              prospectStatus: prospect.state.code as OnboardingStatus,
            })),
        }
      },
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    getProposalWorkspace: build.query<ProposalWorkspace, string>({
      queryFn: async (prospectId, _api, _extra, fetchWithBQ) => {
        const result = await fetchWorkspace(fetchWithBQ as FetchWithBQ, prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    /**
     * La versión nueva arranca con el cuadro de la ÚLTIMA ENVIADA, no en blanco:
     * renegociar en Café es ajustar lo que el hotel ya vio, no volver a
     * capturarlo renglón por renglón. El diálogo lo prometía y el cuerpo iba
     * vacío.
     */
    createProposalDraft: build.mutation<ProposalWorkspace, string>({
      queryFn: async (prospectId, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const previous = await fetchWorkspace(bq, prospectId)
        const lastSent =
          'data' in previous
            ? ([...previous.data.versions]
                .filter((version) => version.sentAt !== null)
                .sort((a, b) => b.version - a.version)[0] ?? null)
            : null

        const createRes = await bq({
          url: `/prospects/${prospectId}/proposals`,
          method: 'POST',
          body: lastSent
            ? {
                ...(lastSent.servicesNote ? { servicesNote: lastSent.servicesNote } : {}),
                rates: lastSent.rates.map((rate) => ({
                  catalogPositionId: rate.positionId,
                  payRate: rate.payRate.toFixed(2),
                  billRate: rate.billRate.toFixed(2),
                })),
              }
            : {},
        })
        if (createRes.error) return { error: createRes.error as never }
        const result = await fetchWorkspace(bq, prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      invalidatesTags: (_result, _error, prospectId) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    saveProposalDraft: build.mutation<ProposalWorkspace, SaveProposalDraftRequest>({
      queryFn: async (request, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const patchRes = await bq({
          url: `/prospects/${request.prospectId}/proposals/${request.proposalId}`,
          method: 'PATCH',
          body: {
            servicesNote: request.servicesNote,
            /* Dos decimales, como el contrato: el cuadro se copia tal cual al firmar. */
            rates: request.rates.map((rate) => ({
              catalogPositionId: rate.positionId,
              payRate: rate.payRate.toFixed(2),
              billRate: rate.billRate.toFixed(2),
            })),
          },
        })
        if (patchRes.error) return { error: patchRes.error as never }
        const result = await fetchWorkspace(bq, request.prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      invalidatesTags: (_result, _error, { prospectId }) => [{ type: 'Prospect', id: prospectId }],
    }),

    sendProposal: build.mutation<ProposalWorkspace, { proposalId: string; prospectId: string }>({
      queryFn: async ({ proposalId, prospectId }, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const sendRes = await bq({
          url: `/prospects/${prospectId}/proposals/${proposalId}/send`,
          method: 'POST',
        })
        if (sendRes.error) return { error: sendRes.error as never }
        const result = await fetchWorkspace(bq, prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetProposalCandidatesQuery,
  useGetProposalTargetsQuery,
  useGetProposalWorkspaceQuery,
  useCreateProposalDraftMutation,
  useSaveProposalDraftMutation,
  useSendProposalMutation,
} = proposalsApi
