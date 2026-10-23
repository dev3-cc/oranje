import type { AssignedHotel } from './messagingWorkersApi'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Los hoteles con alguien asignado en los colaboradores simulados del Pool. */
const ASSIGNED_HOTELS: AssignedHotel[] = [
  { id: 'hotel-1', name: 'Home2 Suites by Hilton Cartersville' },
]

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/workers/assigned-hotels',
    resolve: (): ApiEnvelope<AssignedHotel[]> => ({ data: ASSIGNED_HOTELS }),
  },
]

export function registerMessagingWorkersMocks(): void {
  registerMockRoutes(routes)
}
