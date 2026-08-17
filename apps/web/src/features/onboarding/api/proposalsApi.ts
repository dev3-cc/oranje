import type {
  ProposalCandidate,
  ProposalWorkspace,
  SaveProposalDraftRequest,
} from '../types/proposal.types'

import { registerProposalsMocks } from './proposalsMocks'

import { baseApi } from '@/app/baseApi'

/**
 * Endpoints de Propuestas sobre el `createApi` único (D-12).
 *
 * Se etiquetan con `Prospect` y no con un tag propio: `tagTypes` de `baseApi`
 * es la lista del glosario canónico y Propuesta no tiene fila ahí todavía.
 * Además la propuesta cuelga del prospecto —su versión se ve en la tarjeta del
 * tablero—, así que invalidar el prospecto es justo lo que hace falta. Cuando
 * el glosario gane su fila, esto pasa a un tag `Proposal`.
 */
registerProposalsMocks()

export const proposalsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Vista transversal del módulo Propuestas. Solo lectura. */
    getProposalCandidates: build.query<ProposalCandidate[], void>({
      query: () => '/proposals',
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    getProposalWorkspace: build.query<ProposalWorkspace, string>({
      query: (prospectId) => `/prospects/${prospectId}/proposals`,
      providesTags: (_result, _error, prospectId) => [{ type: 'Prospect', id: prospectId }],
    }),

    /** Abre la siguiente versión. Es POST y no un efecto del GET: leer no crea. */
    createProposalDraft: build.mutation<ProposalWorkspace, string>({
      query: (prospectId) => ({ url: `/prospects/${prospectId}/proposals`, method: 'POST' }),
      invalidatesTags: (_result, _error, prospectId) => [
        { type: 'Prospect', id: prospectId },
        { type: 'Prospect', id: 'LIST' },
      ],
    }),

    saveProposalDraft: build.mutation<ProposalWorkspace, SaveProposalDraftRequest>({
      query: ({ proposalId, prospectId: _prospectId, ...body }) => ({
        url: `/proposals/${proposalId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { prospectId }) => [{ type: 'Prospect', id: prospectId }],
    }),

    sendProposal: build.mutation<ProposalWorkspace, { proposalId: string; prospectId: string }>({
      query: ({ proposalId }) => ({ url: `/proposals/${proposalId}/send`, method: 'POST' }),
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
