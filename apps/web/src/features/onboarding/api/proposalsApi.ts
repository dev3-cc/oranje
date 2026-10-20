import type {
  ProposalCandidate,
  ProposalDraft,
  ProposalRate,
  ProposalTarget,
  ProposalVersionSummary,
  ProposalWorkspace,
  SaveProposalDraftRequest,
  SendDocumentEmailResult,
  SendProposalEmailRequest,
} from '../types/proposal.types'

import { registerProposalsMocks } from './proposalsMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type {
  ApiEnvelope,
  ContractApi,
  ProposalApi,
  ProspectApi,
} from '@/shared/types/apiContract.types'

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
    title: proposal.title ?? '',
    sentAt: proposal.sentAt,
    byName: proposal.sentBy?.fullName ?? '',
    servicesNote: proposal.servicesNote ?? '',
    propertyName: proposal.propertyName ?? '',
    preparedDate: proposal.preparedDate ?? '',
    brandManagementCompany: proposal.brandManagementCompany ?? '',
    cityState: proposal.cityState ?? '',
    contactName: proposal.contactName ?? '',
    senderPhone: proposal.senderPhone ?? '',
    senderEmail: proposal.senderEmail ?? '',
    rates: adaptRates(proposal),
    payRate: toRate(proposal.payRate),
    billRate: toRate(proposal.billRate),
  }
}

function adaptDraft(proposal: ProposalApi): ProposalDraft {
  return {
    id: proposal.id,
    version: proposal.version,
    title: proposal.title ?? '',
    servicesNote: proposal.servicesNote ?? '',
    propertyName: proposal.propertyName ?? '',
    preparedDate: proposal.preparedDate ?? '',
    brandManagementCompany: proposal.brandManagementCompany ?? '',
    cityState: proposal.cityState ?? '',
    contactName: proposal.contactName ?? '',
    senderPhone: proposal.senderPhone ?? '',
    senderEmail: proposal.senderEmail ?? '',
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
  const [prospectRes, proposalsRes, industriesRes, positionsRes] = await Promise.all([
    fetchWithBQ(`/prospects/${prospectId}`),
    fetchWithBQ(`/prospects/${prospectId}/proposals`),
    /* La industria que filtra el puesto (2026-10-17). */
    fetchWithBQ('/catalogs/industries'),
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
    : (
        contactsRes.data as ApiEnvelope<
          Array<{ fullName: string; email: string | null; isPrimary: boolean }>
        >
      ).data
  const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null
  const contactEmail =
    contacts.find((contact) => contact.isPrimary && contact.email)?.email ??
    contacts.find((contact) => contact.email)?.email ??
    null
  /** Prellena el "Dear [CONTACT NAME]" del machote; editable por si no aplica. */
  const contactName = primaryContact?.fullName ?? null

  /* Si Naranja sigue cerrado o se puede reabrir depende de esto (Hugo,
     2026-10-16): un hotel cliente sin ningún contrato vigente no es el mismo
     caso que uno que ya tiene el suyo. */
  const contractsRes = await fetchWithBQ(`/contracts?hotelId=${prospect.hotel.id}&status=ACTIVE`)
  const hasActiveContract = contractsRes.error
    ? false
    : (contractsRes.data as ApiEnvelope<ContractApi[]>).data.length > 0

  return {
    data: {
      prospectId,
      hotelName: prospect.hotel.name,
      owner: { id: prospect.owner.id, name: prospect.owner.fullName, photoUrl: ownerPhotoUrl },
      hotelAddress,
      contactEmail,
      contactName,
      prospectStatus: prospect.state.code as OnboardingStatus,
      draft: draft ? adaptDraft(draft) : null,
      versions: proposals.map(adaptVersion),
      industries: industriesRes.error
        ? []
        : (industriesRes.data as ApiEnvelope<Array<{ id: string; name: string }>>).data,
      positions: positionsRes.error
        ? []
        : (
            positionsRes.data as ApiEnvelope<
              Array<{ id: string; name: string; industryId: string | null }>
            >
          ).data.map((item) => ({ id: item.id, name: item.name, industryId: item.industryId })),
      hasActiveContract,
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
                ...(lastSent.propertyName ? { propertyName: lastSent.propertyName } : {}),
                /* `preparedDate` NO se hereda a propósito: una versión nueva
                   se prepara HOY, no en la fecha de la que ya se envió. */
                ...(lastSent.brandManagementCompany
                  ? { brandManagementCompany: lastSent.brandManagementCompany }
                  : {}),
                ...(lastSent.cityState ? { cityState: lastSent.cityState } : {}),
                ...(lastSent.contactName ? { contactName: lastSent.contactName } : {}),
                ...(lastSent.senderPhone ? { senderPhone: lastSent.senderPhone } : {}),
                ...(lastSent.senderEmail ? { senderEmail: lastSent.senderEmail } : {}),
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
            propertyName: request.propertyName,
            preparedDate: request.preparedDate,
            brandManagementCompany: request.brandManagementCompany,
            cityState: request.cityState,
            contactName: request.contactName,
            senderPhone: request.senderPhone,
            senderEmail: request.senderEmail,
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

    /**
     * «Enviar por correo» de verdad (Hugo, 2026-10-17): congela la versión
     * (como `sendProposal`) Y manda el correo real con el PDF — el que ya
     * generó la pantalla a partir de lo que se ve en la vista previa.
     */
    sendProposalEmail: build.mutation<
      { workspace: ProposalWorkspace; email: SendDocumentEmailResult },
      SendProposalEmailRequest
    >({
      queryFn: async ({ proposalId, prospectId, to, note, pdf }, _api, _extra, fetchWithBQ) => {
        const bq = fetchWithBQ as FetchWithBQ
        const body = new FormData()
        body.append('to', to)
        if (note !== '') body.append('note', note)
        body.append('file', pdf, 'propuesta.pdf')

        const sendRes = await bq({
          url: `/prospects/${prospectId}/proposals/${proposalId}/send-email`,
          method: 'POST',
          body,
        })
        if (sendRes.error) return { error: sendRes.error as never }

        const email = (sendRes.data as { email: SendDocumentEmailResult }).email
        const result = await fetchWorkspace(bq, prospectId)
        return 'error' in result
          ? { error: result.error as never }
          : { data: { workspace: result.data, email } }
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
  useSendProposalEmailMutation,
} = proposalsApi
