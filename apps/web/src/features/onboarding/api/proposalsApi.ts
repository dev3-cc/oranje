import type {
  ProposalCandidate,
  ProposalDraft,
  ProposalVersionSummary,
  ProposalWorkspace,
  SaveProposalDraftRequest,
} from '../types/proposal.types'

import { registerProposalsMocks } from './proposalsMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type { ApiEnvelope, ProposalApi, ProspectApi } from '@/shared/types/apiContract.types'

/**
 * Endpoints de Propuestas sobre el `createApi` único (D-12), alineados al
 * contrato real: TODO vive bajo `/prospects/:id/proposals` — no existe el
 * recurso plano `/proposals/:id`.
 *
 * Las tarifas viajan como STRING en los dos sentidos (`"1250.0000"`): la API
 * valida con regex de decimal y serializa el Decimal con `toFixed(4)`. La
 * frontera numérica es de la UI y se resuelve aquí, en los adaptadores.
 *
 * Se etiquetan con `Prospect` y no con un tag propio: la propuesta cuelga del
 * prospecto y su versión se ve en la tarjeta del tablero.
 */
registerProposalsMocks()

function toRate(value: string | null): number {
  return value === null ? 0 : Number(value)
}

function adaptVersion(proposal: ProposalApi): ProposalVersionSummary {
  return {
    id: proposal.id,
    version: proposal.version,
    status: proposal.isDraft ? 'DRAFT' : 'SENT',
    sentAt: proposal.sentAt,
    byName: proposal.sentBy?.fullName ?? '',
    servicesNote: proposal.servicesNote ?? '',
    payRate: toRate(proposal.payRate),
    billRate: toRate(proposal.billRate),
  }
}

function adaptDraft(proposal: ProposalApi): ProposalDraft {
  return {
    id: proposal.id,
    version: proposal.version,
    servicesNote: proposal.servicesNote ?? '',
    payRate: toRate(proposal.payRate),
    billRate: toRate(proposal.billRate),
  }
}

/**
 * El workspace se arma con DOS recursos: la lista de versiones y el prospecto
 * (nombre del hotel y semáforo para el encabezado del editor).
 */
type FetchWithBQ = (
  args: string | { url: string; method?: string; body?: unknown },
) => Promise<{ data?: unknown; error?: unknown }>

async function fetchWorkspace(
  fetchWithBQ: FetchWithBQ,
  prospectId: string,
): Promise<{ data: ProposalWorkspace } | { error: unknown }> {
  const [prospectRes, proposalsRes] = await Promise.all([
    fetchWithBQ(`/prospects/${prospectId}`),
    fetchWithBQ(`/prospects/${prospectId}/proposals`),
  ])
  if (prospectRes.error) return { error: prospectRes.error }
  if (proposalsRes.error) return { error: proposalsRes.error }

  const prospect = (prospectRes.data as ApiEnvelope<ProspectApi>).data
  const proposals = (proposalsRes.data as ApiEnvelope<ProposalApi[]>).data
  const draft = proposals.find((proposal) => proposal.isDraft) ?? null

  return {
    data: {
      prospectId,
      hotelName: prospect.hotel.name,
      prospectStatus: prospect.state.code as OnboardingStatus,
      draft: draft ? adaptDraft(draft) : null,
      versions: proposals.map(adaptVersion),
    },
  }
}

export const proposalsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * ⚠ Hueco del contrato: la vista transversal del módulo Propuestas no
     * tiene endpoint — habría que pedir las propuestas prospecto por
     * prospecto. Sigue sirviéndose de los fixtures hasta que la API la exponga.
     */
    getProposalCandidates: build.query<ProposalCandidate[], void>({
      query: () => '/proposals',
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    getProposalWorkspace: build.query<ProposalWorkspace, string>({
      queryFn: async (prospectId, _api, _extra, fetchWithBQ) => {
        const result = await fetchWorkspace(fetchWithBQ as FetchWithBQ, prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    /** Abre la siguiente versión. Es POST y no un efecto del GET: leer no crea. */
    createProposalDraft: build.mutation<ProposalWorkspace, string>({
      queryFn: async (prospectId, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const createRes = await bq({
          url: `/prospects/${prospectId}/proposals`,
          method: 'POST',
          body: {},
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

    /**
     * ⚠ El PATCH real REEMPLAZA, no parcha: todo campo omitido se persiste
     * `null`. Por eso siempre viajan los tres valores.
     */
    saveProposalDraft: build.mutation<ProposalWorkspace, SaveProposalDraftRequest>({
      queryFn: async (request, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const patchRes = await bq({
          url: `/prospects/${request.prospectId}/proposals/${request.proposalId}`,
          method: 'PATCH',
          body: {
            servicesNote: request.servicesNote,
            payRate: request.payRate.toFixed(4),
            billRate: request.billRate.toFixed(4),
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
      /** También la lista: enviar cambia la versión que muestra la tarjeta del tablero. */
      invalidatesTags: (_result, _error, { prospectId }) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetProposalCandidatesQuery,
  useGetProposalWorkspaceQuery,
  useCreateProposalDraftMutation,
  useSaveProposalDraftMutation,
  useSendProposalMutation,
} = proposalsApi
