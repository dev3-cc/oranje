import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, RecruitmentTeamMemberApi } from '@/shared/types/apiContract.types'

/** La Manager simulada: a ella le reporta la Líder y una Reclutadora directa. */
export const MOCK_MANAGER_ID = 'usr-mgr-reclutamiento'

const LIDER = { id: 'usr-lider-laura', fullName: 'Laura Peña' }

/** Las mismas requisiciones y colaboradores de los mocks del tablero y del Pool: los enlaces abren algo. */
const REQ_PUERTO_REAL = {
  id: 'req-0004',
  number: '202608120930·K7',
  hotelName: 'Hotel Puerto Real',
  statusCode: 'YELLOW',
}
const REQ_VILLAS_CORAL = {
  id: 'req-0005',
  number: '202608130800·D4',
  hotelName: 'Villas Coral',
  statusCode: 'YELLOW',
}
const REQ_MIRADOR = {
  id: 'req-0008',
  number: '202608160500·G3',
  hotelName: 'Hotel Mirador',
  statusCode: 'YELLOW',
}

const MEMBERS: RecruitmentTeamMemberApi[] = [
  {
    id: LIDER.id,
    fullName: LIDER.fullName,
    email: 'lider-reclutadoras@casacurtidor.com',
    role: { code: 'ROL-R-02', name: 'Líder de Grupo de Reclutadoras' },
    photoUrl: null,
    reportsTo: { id: MOCK_MANAGER_ID, fullName: 'Iván Mora' },
    activeRequisitions: 2,
    coveredRequisitions: 5,
    assignmentsLast30Days: 9,
    workersCreatedLast30Days: 4,
    pendingValidation: 1,
    lastActivityAt: '2026-10-20T16:30:00.000Z',
    openRequisitions: [REQ_MIRADOR, REQ_PUERTO_REAL],
    pendingWorkers: [
      { id: 'wrk-0004', fullName: 'Pedro Alcántara', createdAt: '2026-10-19T15:00:00.000Z' },
    ],
    recentWorkers: [
      {
        id: 'wrk-0004',
        fullName: 'Pedro Alcántara',
        createdAt: '2026-10-19T15:00:00.000Z',
        statusCode: 'WHITE',
      },
      {
        id: 'wrk-0002',
        fullName: 'Luis Cabrera',
        createdAt: '2026-10-14T17:20:00.000Z',
        statusCode: 'ORANGE',
      },
      {
        id: 'wrk-0001',
        fullName: 'Ana Rivera Gómez',
        createdAt: '2026-10-08T16:00:00.000Z',
        statusCode: 'STRONG_GREEN',
      },
      {
        id: 'wrk-0006',
        fullName: 'Rogelio Santos',
        createdAt: '2026-09-29T18:45:00.000Z',
        statusCode: 'GRAY',
      },
    ],
  },
  {
    id: 'usr-recl-marta',
    fullName: 'Marta Solís',
    email: 'reclutadora@casacurtidor.com',
    role: { code: 'ROL-R-01', name: 'Reclutadora' },
    photoUrl: null,
    reportsTo: LIDER,
    activeRequisitions: 3,
    coveredRequisitions: 2,
    assignmentsLast30Days: 6,
    workersCreatedLast30Days: 3,
    pendingValidation: 0,
    lastActivityAt: '2026-10-21T14:00:00.000Z',
    openRequisitions: [REQ_MIRADOR, REQ_VILLAS_CORAL, REQ_PUERTO_REAL],
    pendingWorkers: [],
    recentWorkers: [
      {
        id: 'wrk-0005',
        fullName: 'Julia Mendoza',
        createdAt: '2026-10-21T13:40:00.000Z',
        statusCode: 'BROWN',
      },
      {
        id: 'wrk-0003',
        fullName: 'María Fernanda Ortiz',
        createdAt: '2026-10-16T15:10:00.000Z',
        statusCode: 'STRONG_GREEN',
      },
      {
        id: 'wrk-0007',
        fullName: 'Carmen Iturbe',
        createdAt: '2026-10-02T19:30:00.000Z',
        statusCode: 'BLACK',
      },
    ],
  },
  {
    id: 'usr-recl-vianney',
    fullName: 'Víanney Hernández',
    email: 'vianney@casacurtidor.com',
    role: { code: 'ROL-R-01', name: 'Reclutadora' },
    photoUrl: null,
    reportsTo: { id: MOCK_MANAGER_ID, fullName: 'Iván Mora' },
    activeRequisitions: 0,
    coveredRequisitions: 0,
    assignmentsLast30Days: 0,
    workersCreatedLast30Days: 0,
    pendingValidation: 0,
    lastActivityAt: null,
    openRequisitions: [],
    pendingWorkers: [],
    recentWorkers: [],
  },
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/team/recruitment',
    /** Copias: RTK congela lo servido y el PATCH muta el arreglo. */
    resolve: (): ApiEnvelope<RecruitmentTeamMemberApi[]> => ({
      data: MEMBERS.map((member) => ({ ...member })),
    }),
  },
  {
    method: 'PATCH',
    path: '/team/members/:memberId/reports-to',
    resolve: ({ params, body }): { data: { id: string; reportsToUserId: string } } => {
      const reportsToUserId = ((body ?? {}) as { reportsToUserId?: string }).reportsToUserId ?? ''
      const member = MEMBERS.find((item) => item.id === params.memberId)
      const boss = MEMBERS.find((item) => item.id === reportsToUserId)
      if (member) {
        member.reportsTo = boss
          ? { id: boss.id, fullName: boss.fullName }
          : { id: MOCK_MANAGER_ID, fullName: 'Iván Mora' }
      }
      return { data: { id: params.memberId ?? '', reportsToUserId } }
    },
  },
]

let areRoutesRegistered = false

export function registerRecruitmentTeamMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
