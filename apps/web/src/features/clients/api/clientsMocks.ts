import type { ClientCard, ClientPortfolio, ClientSort } from '../types/client.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures de Clientes Activos. ANDAMIO TEMPORAL — se borra cuando `apps/api`
 * exponga `GET /clients`.
 *
 * Los contratos son los MISMOS folios que salen en Documentos T&C, y cada hotel
 * apunta a su prospecto en `NARANJA` dentro de los fixtures de Onboarding: es la
 * misma tabla vista desde otro lado, y si aquí dijeran otra cosa, el primero que
 * compare las pantallas encontraría un fantasma.
 */
const ITEMS: ClientCard[] = [
  {
    id: 'cli-0001',
    prospectId: 'psp-0012',
    hotelName: 'Hotel Puerto Real',
    zoneName: 'Centro',
    activatedAt: '2026-07-08',
    timezone: 'América/Cancún',
    geofenceRadiusM: 150,
    location: { lat: 21.1743, lng: -86.8466 },
    contract: {
      id: 'ct-0184',
      number: 'CT-2026-0184',
      status: 'ACTIVE',
      positionCount: 4,
      minRate: 170,
      maxRate: 260,
    },
  },
  {
    id: 'cli-0002',
    prospectId: 'psp-0013',
    hotelName: 'Grand Costa Nube',
    zoneName: 'Norte',
    activatedAt: '2026-05-21',
    timezone: 'América/Cancún',
    geofenceRadiusM: 200,
    location: { lat: 21.1401, lng: -86.7768 },
    contract: {
      id: 'ct-0151',
      number: 'CT-2026-0151',
      status: 'ACTIVE',
      positionCount: 3,
      minRate: 165,
      maxRate: 240,
    },
  },
  {
    id: 'cli-0003',
    prospectId: 'psp-0014',
    hotelName: 'Hotel Mirador',
    zoneName: 'Centro',
    activatedAt: '2026-03-03',
    timezone: 'América/Cancún',
    geofenceRadiusM: 120,
    location: { lat: 21.1612, lng: -86.8213 },
    contract: {
      id: 'ct-0098',
      number: 'CT-2026-0098',
      status: 'ACTIVE',
      positionCount: 2,
      minRate: 160,
      maxRate: 230,
    },
  },
  {
    id: 'cli-0004',
    prospectId: 'psp-0015',
    hotelName: 'Villas Coral',
    zoneName: 'Poniente',
    activatedAt: '2026-01-14',
    timezone: 'América/Cancún',
    geofenceRadiusM: 180,
    location: { lat: 21.1288, lng: -86.8702 },
    contract: {
      id: 'ct-0042',
      number: 'CT-2026-0042',
      status: 'EXPIRED',
      positionCount: 3,
      minRate: 155,
      maxRate: 225,
    },
  },
  {
    id: 'cli-0005',
    prospectId: 'psp-0016',
    hotelName: 'Hotel Las Palmas',
    zoneName: 'Norte',
    activatedAt: '2025-11-02',
    timezone: 'América/Cancún',
    geofenceRadiusM: 140,
    location: { lat: 21.1955, lng: -86.8309 },
    // Activado y sin contrato vigente: la vista lo trae igual, porque
    // `activated_at` no depende de que haya contrato.
    contract: null,
  },
]

/** Cartera completa del ejecutivo; la lista es una página de esto. */
const PORTFOLIO_TOTAL = 12

const ZONE_NAMES = ['Centro', 'Norte', 'Poniente']
const ACTIVATION_YEARS = [2026, 2025]

function compare(sort: ClientSort, a: ClientCard, b: ClientCard): number {
  if (sort === 'NAME') return a.hotelName.localeCompare(b.hotelName, 'es')
  if (sort === 'OLDEST') return a.activatedAt.localeCompare(b.activatedAt)
  return b.activatedAt.localeCompare(a.activatedAt)
}

function matches(
  item: ClientCard,
  search: string,
  zone: string,
  contractStatus: string,
  year: string,
): boolean {
  if (zone !== 'ALL' && item.zoneName !== zone) return false
  if (year !== 'ALL' && !item.activatedAt.startsWith(year)) return false

  // Sin contrato no puede coincidir con un filtro de estado de contrato.
  if (contractStatus !== 'ALL' && item.contract?.status !== contractStatus) return false

  if (search === '') return true
  return item.hotelName.toLocaleLowerCase().includes(search.toLocaleLowerCase())
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/clients',
    resolve: ({ search }): ClientPortfolio => {
      const sort = (search.get('sort') ?? 'RECENT') as ClientSort

      return {
        items: ITEMS.filter((item) =>
          matches(
            item,
            search.get('search') ?? '',
            search.get('zone') ?? 'ALL',
            search.get('contractStatus') ?? 'ALL',
            search.get('year') ?? 'ALL',
          ),
        ).sort((a, b) => compare(sort, a, b)),
        total: PORTFOLIO_TOTAL,
        zoneNames: ZONE_NAMES,
        activationYears: ACTIVATION_YEARS,
      }
    },
  },
]

let areRoutesRegistered = false

export function registerClientsMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
