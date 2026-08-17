import type {
  ProposalCandidate,
  ProposalVersionSummary,
  ProposalWorkspace,
} from '../types/proposal.types'

import { getProspectIdentity } from './onboardingMocks'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures de las propuestas. ANDAMIO TEMPORAL — se borra cuando `apps/api`
 * exponga los endpoints.
 *
 * El nombre del hotel y su semáforo NO se repiten aquí: salen de
 * `getProspectIdentity`, que lee los mismos fixtures que la ficha del
 * prospecto. La propuesta cuelga del prospecto, y el prospecto tiene un solo
 * nombre.
 *
 * Hotel Mirador reproduce la captura al pie de la letra: v3 en borrador, v2 y
 * v1 enviadas. Hotel Puerto Real se dejó SIN borrador abierto a propósito, para
 * poder ver el estado vacío y el alta de una versión nueva.
 */

/**
 * Versión almacenada. Hoy es idéntica al resumen; se mantiene el alias porque
 * el registro guardado y lo que viaja al front no tienen por qué coincidir.
 */
type StoredVersion = ProposalVersionSummary

/** De la más nueva a la más vieja. Como mucho UNA en borrador. */
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

/** Hoy el resumen y lo almacenado coinciden; la función marca dónde separarlos. */
function toSummary(version: StoredVersion): ProposalVersionSummary {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    sentAt: version.sentAt,
    byName: version.byName,
    servicesNote: version.servicesNote,
    payRate: version.payRate,
    billRate: version.billRate,
  }
}

function readWorkspace(prospectId: string): ProposalWorkspace {
  const identity = getProspectIdentity(prospectId)
  if (!identity) throw new Error(`No existe el prospecto ${prospectId}`)

  const versions = versionsByProspect.get(prospectId) ?? []
  const draft = versions.find((version) => version.status === 'DRAFT')

  return {
    prospectId,
    hotelName: identity.hotelName,
    prospectStatus: identity.status,
    draft: draft
      ? {
          id: draft.id,
          version: draft.version,
          servicesNote: draft.servicesNote,
          payRate: draft.payRate,
          billRate: draft.billRate,
        }
      : null,
    versions: versions.map(toSummary),
  }
}

function findProspectByProposalId(proposalId: string): string {
  for (const [prospectId, versions] of versionsByProspect) {
    if (versions.some((version) => version.id === proposalId)) return prospectId
  }
  throw new Error(`No existe la propuesta ${proposalId}`)
}

function createDraft(prospectId: string): ProposalWorkspace {
  if (!getProspectIdentity(prospectId)) throw new Error(`No existe el prospecto ${prospectId}`)

  const versions = versionsByProspect.get(prospectId) ?? []
  if (versions.some((version) => version.status === 'DRAFT')) {
    throw new Error('Ya hay una versión en borrador')
  }

  // La versión nueva arranca de la última enviada: se negocia sobre lo anterior.
  const [latest] = versions
  const nextVersion = (latest?.version ?? 0) + 1

  versionsByProspect.set(prospectId, [
    {
      id: `prp-${prospectId}-${nextVersion}`,
      version: nextVersion,
      status: 'DRAFT',
      sentAt: null,
      byName: 'Ana Ruiz',
      payRate: latest?.payRate ?? 0,
      billRate: latest?.billRate ?? 0,
      servicesNote: latest?.servicesNote ?? '',
    },
    ...versions,
  ])

  return readWorkspace(prospectId)
}

function saveDraft(proposalId: string, body: unknown): ProposalWorkspace {
  const payload = body as { servicesNote?: string; payRate?: number; billRate?: number } | undefined
  const prospectId = findProspectByProposalId(proposalId)
  const version = versionsByProspect.get(prospectId)?.find((item) => item.id === proposalId)

  if (!version) throw new Error(`No existe la propuesta ${proposalId}`)
  if (version.status === 'SENT') throw new Error('Una propuesta enviada ya no se edita')

  version.servicesNote = payload?.servicesNote ?? version.servicesNote
  version.payRate = payload?.payRate ?? version.payRate
  version.billRate = payload?.billRate ?? version.billRate

  return readWorkspace(prospectId)
}

function sendProposal(proposalId: string): ProposalWorkspace {
  const prospectId = findProspectByProposalId(proposalId)
  const version = versionsByProspect.get(prospectId)?.find((item) => item.id === proposalId)

  if (!version) throw new Error(`No existe la propuesta ${proposalId}`)
  if (version.status === 'SENT') throw new Error('Esta propuesta ya se envió')
  if (!version.servicesNote.trim()) throw new Error('La propuesta necesita una descripción')

  version.status = 'SENT'
  version.sentAt = todayIso()

  return readWorkspace(prospectId)
}

/**
 * Todos los hoteles que tienen al menos una versión. Los que nunca se
 * cotizaron no salen: el módulo lista propuestas, no prospectos.
 */
function listCandidates(): ProposalCandidate[] {
  const candidates: ProposalCandidate[] = []

  for (const [prospectId, versions] of versionsByProspect) {
    const identity = getProspectIdentity(prospectId)
    const [latest] = versions
    if (!identity || !latest) continue

    candidates.push({
      prospectId,
      hotelName: identity.hotelName,
      zone: identity.zone,
      prospectStatus: identity.status,
      latestVersion: latest.version,
      latestVersionStatus: latest.status,
      latestSentAt: latest.sentAt,
    })
  }

  return candidates
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/proposals',
    resolve: (): ProposalCandidate[] => listCandidates(),
  },
  {
    method: 'GET',
    path: '/prospects/:prospectId/proposals',
    resolve: ({ params }): ProposalWorkspace => readWorkspace(params.prospectId ?? ''),
  },
  {
    method: 'POST',
    path: '/prospects/:prospectId/proposals',
    resolve: ({ params }): ProposalWorkspace => createDraft(params.prospectId ?? ''),
  },
  {
    method: 'PATCH',
    path: '/proposals/:proposalId',
    resolve: ({ params, body }): ProposalWorkspace => saveDraft(params.proposalId ?? '', body),
  },
  {
    method: 'POST',
    path: '/proposals/:proposalId/send',
    resolve: ({ params }): ProposalWorkspace => sendProposal(params.proposalId ?? ''),
  },
]

let areRoutesRegistered = false

export function registerProposalsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
