import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, HotelTeamMemberApi } from '@/shared/types/apiContract.types'

/** El Manager General simulado: le reportan dos gerentes; uno tiene dos supervisores. */
export const MOCK_GENERAL_MANAGER_ID = 'usr-mgr-general'

const GENERAL = { id: MOCK_GENERAL_MANAGER_ID, fullName: 'Gerardo Ruiz' }
const HOUSEKEEPING = { id: 'dep-hk', name: 'Housekeeping' }
const ALIMENTOS = { id: 'dep-ayb', name: 'Alimentos y Bebidas' }
const ALMA = { id: 'usr-gh-alma', fullName: 'Alma Torres' }

const MEMBERS: HotelTeamMemberApi[] = [
  {
    id: ALMA.id,
    fullName: ALMA.fullName,
    email: 'mgr-area@casacurtidor.com',
    role: { code: 'ROL-H-02', name: 'Manager de Área' },
    photoUrl: null,
    department: HOUSEKEEPING,
    reportsTo: GENERAL,
    supervisorsInCharge: 2,
    activeWorkers: 18,
    requisitionsThisMonth: null,
  },
  {
    id: 'usr-gh-bruno',
    fullName: 'Bruno Salas',
    email: 'bruno.salas@casacurtidor.com',
    role: { code: 'ROL-H-02', name: 'Manager de Área' },
    photoUrl: null,
    department: ALIMENTOS,
    reportsTo: GENERAL,
    supervisorsInCharge: 0,
    activeWorkers: 6,
    requisitionsThisMonth: null,
  },
  {
    id: 'usr-sup-saul',
    fullName: 'Saúl Méndez',
    email: 'supervisor@casacurtidor.com',
    role: { code: 'ROL-H-01', name: 'Supervisor' },
    photoUrl: null,
    department: HOUSEKEEPING,
    reportsTo: ALMA,
    supervisorsInCharge: null,
    activeWorkers: null,
    requisitionsThisMonth: 3,
  },
  {
    id: 'usr-sup-irene',
    fullName: 'Irene Cano',
    email: 'irene.cano@casacurtidor.com',
    role: { code: 'ROL-H-01', name: 'Supervisor' },
    photoUrl: null,
    department: HOUSEKEEPING,
    reportsTo: ALMA,
    supervisorsInCharge: null,
    activeWorkers: null,
    requisitionsThisMonth: 0,
  },
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/team/hotel',
    resolve: (): ApiEnvelope<HotelTeamMemberApi[]> => ({
      data: MEMBERS.map((member) => ({ ...member })),
    }),
  },
]

let areRoutesRegistered = false

export function registerHotelTeamMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
