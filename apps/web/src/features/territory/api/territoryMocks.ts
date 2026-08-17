import type { Territory, TerritoryHotel, TerritoryZone } from '../types/territory.types'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'

/**
 * Fixtures de Mi Territorio. ANDAMIO TEMPORAL — se borra cuando `apps/api`
 * exponga `GET /territory`.
 *
 * ⚠ Las coordenadas son de CANCÚN, no de las de la captura.
 *
 * El mapa del diseño muestra Birmingham, Alabama: es la ubicación por defecto
 * de la herramienta con la que se maquetó, no un dato del negocio. Todo lo
 * demás de la pantalla apunta a Quintana Roo (`America/Cancun`, teléfonos +52
 * 998), así que los puntos se sembraron ahí. La ubicación es dato, no diseño.
 *
 * Los cinco primeros hoteles son, en orden, los de la captura. Los dos de Zona
 * Sur se agregaron para que el chip «Sur» no devuelva una lista vacía al
 * filtrar.
 */

const ZONES: TerritoryZone[] = [
  { id: 'norte', label: 'Norte', count: 14 },
  { id: 'centro', label: 'Centro', count: 11 },
  { id: 'sur', label: 'Sur', count: 13 },
]

const HOTELS: TerritoryHotel[] = [
  {
    id: 'psp-0007',
    hotelName: 'Hotel Puerto Real',
    zoneId: 'centro',
    zone: 'Zona Centro',
    status: 'ROSA',
    daysInStatus: 7,
    clientSince: null,
    location: { lat: 21.1619, lng: -86.8515 },
    geofenceMeters: 150,
    timeZone: 'America/Cancun',
    recentHistory: [
      { id: 'thl-0007-3', status: 'ROSA', changedAt: '2026-06-18' },
      { id: 'thl-0007-2', status: 'AMARILLO', changedAt: '2026-06-03' },
      { id: 'thl-0007-1', status: 'VERDE', changedAt: '2026-05-21' },
    ],
  },
  {
    id: 'psp-0004',
    hotelName: 'Grand Costa Nube',
    zoneId: 'norte',
    zone: 'Zona Norte',
    status: 'AZUL_CLARO',
    daysInStatus: 6,
    clientSince: null,
    location: { lat: 21.1743, lng: -86.8466 },
    geofenceMeters: 120,
    timeZone: 'America/Cancun',
    recentHistory: [
      { id: 'thl-0004-2', status: 'AZUL_CLARO', changedAt: '2026-08-04' },
      { id: 'thl-0004-1', status: 'GRIS', changedAt: '2026-07-28' },
    ],
  },
  {
    id: 'psp-0012',
    hotelName: 'Hotel Vista Laguna',
    zoneId: 'norte',
    zone: 'Zona Norte',
    status: 'NARANJA',
    daysInStatus: 33,
    clientSince: '2026-07-08',
    location: { lat: 21.1801, lng: -86.8395 },
    geofenceMeters: 200,
    timeZone: 'America/Cancun',
    recentHistory: [
      { id: 'thl-0012-3', status: 'NARANJA', changedAt: '2026-07-08' },
      { id: 'thl-0012-2', status: 'ROSA', changedAt: '2026-06-24' },
      { id: 'thl-0012-1', status: 'AMARILLO', changedAt: '2026-06-11' },
    ],
  },
  {
    id: 'psp-0008',
    hotelName: 'Hotel Mirador',
    zoneId: 'centro',
    zone: 'Zona Centro',
    status: 'VERDE',
    daysInStatus: 5,
    clientSince: null,
    location: { lat: 21.1585, lng: -86.8462 },
    geofenceMeters: 150,
    timeZone: 'America/Cancun',
    recentHistory: [
      { id: 'thl-0008-2', status: 'VERDE', changedAt: '2026-08-05' },
      { id: 'thl-0008-1', status: 'AZUL_CLARO', changedAt: '2026-07-22' },
    ],
  },
  {
    id: 'psp-0013',
    hotelName: 'Hostal Del Sol',
    zoneId: 'centro',
    zone: 'Zona Centro',
    status: 'ROJO',
    daysInStatus: 20,
    clientSince: null,
    location: { lat: 21.1522, lng: -86.8551 },
    geofenceMeters: 100,
    timeZone: 'America/Cancun',
    recentHistory: [
      { id: 'thl-0013-2', status: 'ROJO', changedAt: '2026-07-21' },
      { id: 'thl-0013-1', status: 'AZUL_CLARO', changedAt: '2026-07-02' },
    ],
  },
  {
    id: 'psp-0006',
    hotelName: 'Suites del Carmen',
    zoneId: 'sur',
    zone: 'Zona Sur',
    status: 'AZUL_CLARO',
    daysInStatus: 9,
    clientSince: null,
    location: { lat: 21.118, lng: -86.848 },
    geofenceMeters: 120,
    timeZone: 'America/Cancun',
    recentHistory: [
      { id: 'thl-0006-2', status: 'AZUL_CLARO', changedAt: '2026-08-01' },
      { id: 'thl-0006-1', status: 'GRIS', changedAt: '2026-07-19' },
    ],
  },
  {
    id: 'psp-0010',
    hotelName: 'Hotel Las Palmas',
    zoneId: 'sur',
    zone: 'Zona Sur',
    status: 'AMARILLO',
    daysInStatus: 8,
    clientSince: null,
    location: { lat: 21.124, lng: -86.861 },
    geofenceMeters: 150,
    timeZone: 'America/Cancun',
    recentHistory: [
      { id: 'thl-0010-2', status: 'AMARILLO', changedAt: '2026-08-02' },
      { id: 'thl-0010-1', status: 'VERDE', changedAt: '2026-07-14' },
    ],
  },
]

/** Minúsculas y sin acentos, para que «bahia» encuentre «Bahía». */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/territory',
    resolve: ({ search }): Territory => {
      const zoneId = search.get('zoneId')
      const query = search.get('q')

      const hotels = HOTELS.filter((hotel) => {
        if (zoneId && hotel.zoneId !== zoneId) return false
        // Sin acentos a los dos lados: «bahia» tiene que encontrar «Bahía».
        if (query && !normalize(hotel.hotelName).includes(normalize(query))) return false
        return true
      })

      return { total: 38, zones: ZONES, hotels }
    },
  },
]

let areRoutesRegistered = false

export function registerTerritoryMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
}
