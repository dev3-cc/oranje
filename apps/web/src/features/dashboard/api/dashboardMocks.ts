import type { DashboardOverview } from '../types/dashboard.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixture del dashboard. ANDAMIO TEMPORAL — se borra cuando `apps/api` exponga
 * `GET /dashboard`.
 *
 * Las cifras son las de la captura, para poder comparar pantalla contra
 * maqueta. Contra la API real se calcularán en el backend: son agregados sobre
 * todo el territorio, no algo que el front pueda derivar de la página que tiene
 * cargada.
 */
const OVERVIEW: DashboardOverview = {
  owner: { name: 'Ana Ruiz', roleLabel: 'BD' },
  scope: { zones: ['Norte', 'Centro', 'Sur'], periodLabel: 'trimestre en curso' },
  metrics: {
    openProspects: 38,
    staleProspects: 6,
    conversionRate: 0.21,
    averageConversionDays: 47,
    activeClients: 12,
  },
  funnel: [
    { status: 'GRIS', count: 12 },
    { status: 'AZUL_CLARO', count: 8 },
    { status: 'VERDE', count: 6 },
    { status: 'AMARILLO', count: 5 },
    { status: 'ROSA', count: 3 },
    { status: 'NARANJA', count: 2 },
  ],
  staleProspects: [
    {
      prospectId: 'psp-0011',
      hotelName: 'Villas Coral',
      daysWithoutAttempt: 15,
      status: 'AMARILLO',
    },
    {
      prospectId: 'psp-0006',
      hotelName: 'Suites del Carmen',
      daysWithoutAttempt: 9,
      status: 'AZUL_CLARO',
    },
    {
      prospectId: 'psp-0002',
      hotelName: 'Casa Tulum Boutique',
      daysWithoutAttempt: 11,
      status: 'GRIS',
    },
    {
      prospectId: 'psp-0009',
      hotelName: 'Resort Isla Blanca',
      daysWithoutAttempt: 12,
      status: 'VERDE',
    },
  ],
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/dashboard',
    resolve: (): DashboardOverview => OVERVIEW,
  },
]

let areRoutesRegistered = false

export function registerDashboardMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
