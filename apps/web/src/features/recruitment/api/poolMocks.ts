import type { PoolWorker, WorkerPool } from '../types/pool.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures del Pool. ANDAMIO TEMPORAL — se borra cuando exista
 * `coverage.vw_pool` y `app_user` tenga GRANT sobre `personal`.
 *
 * Las seis filas son las de la captura. `age`, `isProfileComplete` y `hasTaxId`
 * llegan calculadas, como las mandaría la vista: aquí no se derivan de una
 * fecha de nacimiento porque el front no debe saber calcularlas.
 */
const ITEMS: PoolWorker[] = [
  {
    id: 'wrk-0001',
    fullName: 'María Sandoval',
    age: 34,
    zoneName: 'Centro',
    catalogPosition: 'Housekeeper',
    englishLevel: 'BASICO',
    hiringModality: 'TIEMPO_COMPLETO',
    status: 'STRONG_GREEN',
    isProfileComplete: true,
    hasTaxId: true,
  },
  {
    id: 'wrk-0002',
    fullName: 'José Rivera',
    age: 29,
    zoneName: 'Este',
    catalogPosition: 'Houseman',
    englishLevel: 'CONVERSACIONAL',
    hiringModality: 'TIEMPO_COMPLETO',
    status: 'ORANGE',
    isProfileComplete: true,
    hasTaxId: true,
  },
  {
    id: 'wrk-0003',
    fullName: 'Ana Delgado',
    age: 41,
    zoneName: 'Centro',
    catalogPosition: 'Laundry',
    englishLevel: 'BASICO',
    hiringModality: 'MEDIO_TIEMPO',
    status: 'YELLOW',
    isProfileComplete: true,
    hasTaxId: false,
  },
  {
    id: 'wrk-0004',
    fullName: 'Luis Ferrer',
    age: 25,
    zoneName: 'Sur',
    catalogPosition: 'Chef',
    englishLevel: 'AVANZADO',
    hiringModality: 'SEGUN_SOLICITUD',
    status: 'WHITE',
    // El único con perfil incompleto: sin ITIN y sin expediente cerrado.
    isProfileComplete: false,
    hasTaxId: false,
  },
  {
    id: 'wrk-0005',
    fullName: 'Rosa Navarro',
    age: 38,
    zoneName: 'Noroeste',
    catalogPosition: 'Housekeeper',
    englishLevel: 'INTERMEDIO',
    hiringModality: 'TEMPORAL',
    status: 'PINK',
    isProfileComplete: true,
    hasTaxId: true,
  },
  {
    id: 'wrk-0006',
    fullName: 'Ernesto Lara',
    age: 52,
    zoneName: 'Oeste',
    catalogPosition: 'Houseman',
    englishLevel: 'BASICO',
    hiringModality: 'TIEMPO_COMPLETO',
    status: 'BROWN',
    isProfileComplete: true,
    hasTaxId: true,
  },
]

/** El pool completo del reclutador; la tabla es una página de esto. */
const POOL_TOTAL = 148

const ZONE_NAMES = ['Centro', 'Norte', 'Noroeste', 'Este', 'Oeste', 'Sur']

function matches(item: PoolWorker, params: URLSearchParams): boolean {
  const checks: [string, string][] = [
    [params.get('position') ?? 'ALL', item.catalogPosition],
    [params.get('zone') ?? 'ALL', item.zoneName],
    [params.get('english') ?? 'ALL', item.englishLevel],
    [params.get('modality') ?? 'ALL', item.hiringModality],
    [params.get('status') ?? 'ALL', item.status],
  ]

  return checks.every(([wanted, actual]) => wanted === 'ALL' || wanted === actual)
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/pool',
    resolve: ({ search }): WorkerPool => ({
      items: ITEMS.filter((item) => matches(item, search)),
      total: POOL_TOTAL,
      zoneNames: ZONE_NAMES,
    }),
  },
]

let areRoutesRegistered = false

export function registerPoolMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
