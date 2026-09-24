/*
 * ⚠ Import entre features, permitido SOLO aquí: las métricas salen de
 * `/prospects`, cuyo mock vive en Onboarding. Con mocks apagados, no-op.
 */
// eslint-disable-next-line no-restricted-imports
import { registerOnboardingMocks } from '@/features/onboarding/api/onboardingMocks'
import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope, TeamMemberApi } from '@/shared/types/apiContract.types'

/**
 * Fixture de `/team` en la forma CRUDA del contrato real. Ana Ruiz es la dueña
 * de TODOS los prospectos de los fixtures de Onboarding: sus métricas salen
 * vivas. Los otros dos BDs existen sin cartera — el equipo recién repartido se
 * ve así, y la pantalla debe soportarlo sin fingir números.
 */
const MEMBERS: TeamMemberApi[] = [
  {
    id: 'usr-ana-ruiz',
    fullName: 'Ana Ruiz',
    email: 'ana.ruiz@casacurtidor.com',
    role: { code: 'ROL-V-01', name: 'Business Developer' },
    photoUrl: null,
    zones: [
      { id: 'norte', code: 'NORTE', name: 'Zona Norte' },
      { id: 'centro', code: 'CENTRO', name: 'Zona Centro' },
      { id: 'sur', code: 'SUR', name: 'Zona Sur' },
    ],
    openProspects: 11,
  },
  {
    id: 'usr-diego',
    fullName: 'Diego Peña',
    email: 'diego.pena@casacurtidor.com',
    role: { code: 'ROL-V-01', name: 'Business Developer' },
    photoUrl: null,
    zones: [{ id: 'este', code: 'ESTE', name: 'Zona Este' }],
    openProspects: 0,
  },
  {
    id: 'usr-rocio',
    fullName: 'Rocío Lima',
    email: 'rocio.lima@casacurtidor.com',
    role: { code: 'ROL-V-01', name: 'Business Developer' },
    photoUrl: null,
    zones: [],
    openProspects: 0,
  },
]

/**
 * Zonas de gente FUERA de `MEMBERS` (hoy: el Inspector, desde el alta de
 * personal del Administrador) — mismo endpoint `/users/:id/zones`, pero sin
 * inflar `/team`, que es la lista de BDs del BDC y no debe verlos.
 */
const otherZones = new Map<string, TeamMemberApi['zones']>()

function zonesOf(userId: string): TeamMemberApi['zones'] | undefined {
  return MEMBERS.find((item) => item.id === userId)?.zones ?? otherZones.get(userId)
}

function setZonesOf(userId: string, zones: TeamMemberApi['zones']): void {
  const member = MEMBERS.find((item) => item.id === userId)
  if (member) member.zones = zones
  else otherZones.set(userId, zones)
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/team',
    /** Copias: RTK congela lo servido y el PUT de zonas muta el store. */
    resolve: (): ApiEnvelope<TeamMemberApi[]> => ({
      data: MEMBERS.map((member) => ({
        ...member,
        zones: member.zones.map((zone) => ({ ...zone })),
      })),
    }),
  },
  {
    method: 'PUT',
    path: '/users/:userId/zones',
    resolve: ({ params, body }): { data: null } => {
      const zoneIds = ((body ?? {}) as { zoneIds?: string[] }).zoneIds ?? []
      setZonesOf(
        params.userId ?? '',
        zoneIds.map((zoneId) => ({
          id: zoneId,
          code: zoneId.toUpperCase(),
          name: `Zona ${zoneId.charAt(0).toUpperCase()}${zoneId.slice(1)}`,
        })),
      )
      return { data: null }
    },
  },
  /**
   * LEER las zonas de una persona (Mi Territorio la consume para acotar el
   * mapa a quien se elija en el selector de dueño, y el alta de personal para
   * precargar las del Inspector al editar) — mismo recurso que el PUT de
   * arriba, mismo almacén, para que asignar y filtrar nunca se desincronicen.
   */
  {
    method: 'GET',
    path: '/users/:userId/zones',
    resolve: ({ params }): { data: { zones: TeamMemberApi['zones'] } } => ({
      data: { zones: (zonesOf(params.userId ?? '') ?? []).map((zone) => ({ ...zone })) },
    }),
  },
]

let areRoutesRegistered = false

export function registerTeamMocks(): void {
  if (areRoutesRegistered) return
  areRoutesRegistered = true
  registerMockRoutes(routes)
  registerOnboardingMocks()
}
