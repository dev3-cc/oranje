import type { ProposalVersionSummary } from '../types/proposal.types'

import { getProspectIdentity, registerOnboardingMocks } from './onboardingMocks'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, ProposalApi } from '@/shared/types/apiContract.types'

type StoredVersion = ProposalVersionSummary

const versionsByProspect = new Map<string, StoredVersion[]>([
  [
    'psp-0008',
    [
      {
        id: 'prp-0008-3',
        version: 3,
        status: 'DRAFT',
        sentAt: null,
        byName: 'Ana Ruiz',
        payRate: 185,
        billRate: 265,
        servicesNote: 'Housekeeping y Steward para temporada alta, cobertura 7 días.',
      },
      {
        id: 'prp-0008-2',
        version: 2,
        status: 'SENT',
        sentAt: '2026-06-03',
        byName: 'Ana Ruiz',
        payRate: 185,
        billRate: 265,
        servicesNote: 'Housekeeping y Steward para temporada alta.',
      },
      {
        id: 'prp-0008-1',
        version: 1,
        status: 'SENT',
        sentAt: '2026-05-21',
        byName: 'Ana Ruiz',
        payRate: 170,
        billRate: 250,
        servicesNote: 'Housekeeping para temporada alta.',
      },
    ],
  ],
  [
    'psp-0007',
    [
      {
        id: 'prp-0007-2',
        version: 2,
        status: 'SENT',
        sentAt: '2026-06-03',
        byName: 'Ana Ruiz',
        payRate: 185,
        billRate: 265,
        servicesNote: 'Housekeeping, Steward y Chef de apoyo.',
      },
      {
        id: 'prp-0007-1',
        version: 1,
        status: 'SENT',
        sentAt: '2026-05-21',
        byName: 'Ana Ruiz',
        payRate: 170,
        billRate: 250,
        servicesNote: 'Housekeeping y Steward.',
      },
    ],
  ],
  [
    'psp-0009',
    [
      {
        id: 'prp-0009-1',
        version: 1,
        status: 'SENT',
        sentAt: '2026-07-28',
        byName: 'Ana Ruiz',
        payRate: 175,
        billRate: 255,
        servicesNote: 'Housekeeping para bloque de 40 habitaciones.',
      },
    ],
  ],
  [
    'psp-0010',
    [
      {
        id: 'prp-0010-1',
        version: 1,
        status: 'SENT',
        sentAt: '2026-07-14',
        byName: 'Ana Ruiz',
        payRate: 168,
        billRate: 245,
        servicesNote: 'Steward para eventos de fin de semana.',
      },
    ],
  ],
  [
    'psp-0011',
    [
      {
        id: 'prp-0011-1',
        version: 1,
        status: 'SENT',
        sentAt: '2026-07-02',
        byName: 'Ana Ruiz',
        payRate: 172,
        billRate: 250,
        servicesNote: 'Housekeeping de refuerzo entre semana.',
      },
    ],
  ],
])

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function toProposalApi(version: StoredVersion): ProposalApi {
  return {
    id: version.id,
    version: version.version,
    servicesNote: version.servicesNote || null,
    payRate: version.payRate.toFixed(4),
    billRate: version.billRate.toFixed(4),
    isDraft: version.status === 'DRAFT',
    sentBy: version.sentAt ? { id: 'usr-ana-ruiz', fullName: version.byName } : null,
    sentAt: version.sentAt,
    createdAt: version.sentAt ?? todayIso(),
    updatedAt: null,
  }
}

function readVersions(prospectId: string): StoredVersion[] {
  if (!getProspectIdentity(prospectId)) throw new Error(`No existe el prospecto ${prospectId}`)
  return versionsByProspect.get(prospectId) ?? []
}

function findVersion(prospectId: string, proposalId: string): StoredVersion {
  const version = readVersions(prospectId).find((item) => item.id === proposalId)
  if (!version) throw new Error(`No existe la propuesta ${proposalId}`)
  return version
}

function createDraft(prospectId: string): ProposalApi {
  const versions = readVersions(prospectId)
  if (versions.some((version) => version.status === 'DRAFT')) {
    throw new Error('Ya hay una versión en borrador')
  }

  const [latest] = versions
  const nextVersion = (latest?.version ?? 0) + 1

  const draft: StoredVersion = {
    id: `prp-${prospectId}-${nextVersion}`,
    version: nextVersion,
    status: 'DRAFT',
    sentAt: null,
    byName: 'Ana Ruiz',
    payRate: latest?.payRate ?? 0,
    billRate: latest?.billRate ?? 0,
    servicesNote: latest?.servicesNote ?? '',
  }
  versionsByProspect.set(prospectId, [draft, ...versions])
  return toProposalApi(draft)
}

interface SaveDraftBody {
  servicesNote?: string
  payRate?: string
  billRate?: string
}

function saveDraft(prospectId: string, proposalId: string, body: unknown): ProposalApi {
  const payload = (body ?? {}) as SaveDraftBody
  const version = findVersion(prospectId, proposalId)
  if (version.status === 'SENT') throw new Error('Una propuesta enviada ya no se edita')

  version.servicesNote = payload.servicesNote ?? ''
  version.payRate = payload.payRate ? Number(payload.payRate) : 0
  version.billRate = payload.billRate ? Number(payload.billRate) : 0

  return toProposalApi(version)
}

function sendProposal(prospectId: string, proposalId: string): ProposalApi {
  const version = findVersion(prospectId, proposalId)
  if (version.status === 'SENT') throw new Error('Esta propuesta ya se envió')
  if (!version.servicesNote.trim()) throw new Error('La propuesta necesita una descripción')

  version.status = 'SENT'
  version.sentAt = todayIso()

  return toProposalApi(version)
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/prospects/:prospectId/proposals',
    resolve: ({ params }): ApiEnvelope<ProposalApi[]> => ({
      data: readVersions(params.prospectId ?? '').map(toProposalApi),
    }),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/proposals',
    resolve: ({ params }): ApiEnvelope<ProposalApi> => ({
      data: createDraft(params.prospectId ?? ''),
    }),
  },
  {
    method: 'PATCH',
    path: '/prospects/:prospectId/proposals/:proposalId',
    resolve: ({ params, body }): ApiEnvelope<ProposalApi> => ({
      data: saveDraft(params.prospectId ?? '', params.proposalId ?? '', body),
    }),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/proposals/:proposalId/send',
    resolve: ({ params }): ApiEnvelope<ProposalApi> => ({
      data: sendProposal(params.prospectId ?? '', params.proposalId ?? ''),
    }),
  },
]

let areRoutesRegistered = false

export function registerProposalsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerOnboardingMocks()
  registerMockRoutes(routes)
}
