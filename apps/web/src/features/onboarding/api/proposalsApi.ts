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
import type {
  ApiEnvelope,
  PaginatedEnvelope,
  ProposalApi,
  ProspectApi,
} from '@/shared/types/apiContract.types'

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
    getProposalCandidates: build.query<ProposalCandidate[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const res = await bq('/prospects?limit=100&includeClosed=true')
        if (res.error) return { error: res.error as never }

        const prospects = (res.data as PaginatedEnvelope<ProspectApi>).data
        const candidates: ProposalCandidate[] = []
        for (const prospect of prospects) {
          const last = prospect.lastProposal
          if (!last) continue
          candidates.push({
            prospectId: prospect.id,
            hotelName: prospect.hotel.name,
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

    getProposalWorkspace: build.query<ProposalWorkspace, string>({
      queryFn: async (prospectId, _api, _extra, fetchWithBQ) => {
        const result = await fetchWorkspace(fetchWithBQ as FetchWithBQ, prospectId)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

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
