import type { TeamMemberCard, TeamMemberCycle, TeamOverview } from '../types/team.types'

import { registerTeamMocks } from './teamMocks'

import { baseApi } from '@/app/baseApi'
import { PIPELINE_COLUMNS } from '@/shared/constants/onboardingStatus'
import type {
  ApiEnvelope,
  PaginatedEnvelope,
  ProspectApi,
  TeamMemberApi,
} from '@/shared/types/apiContract.types'

/**
 * Mi Equipo (BDC) se COMPONE de `/team` (los BDs a cargo, con sus zonas) y
 * `/prospects` con los ciclos cerrados (las métricas por dueño). El backend ya
 * acota `/team` a quienes reportan al que pregunta; un BD recibe 403 y esta
 * pantalla no es suya.
 */
registerTeamMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

const MS_PER_DAY = 86_400_000
const STALE_DAYS = 7

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(
    0,
    Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / MS_PER_DAY),
  )
}

/** El arranque del trimestre en curso, para contar solo sus conversiones. */
function quarterStart(): string {
  const now = new Date()
  const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3
  return new Date(Date.UTC(now.getUTCFullYear(), quarterMonth, 1)).toISOString()
}

function buildMemberCard(member: TeamMemberApi, prospects: ProspectApi[]): TeamMemberCard {
  const own = prospects.filter((prospect) => prospect.owner.id === member.id)
  const open = own.filter((prospect) => prospect.isOpen && prospect.state.code !== 'ORANGE')
  const converted = own.filter((prospect) => prospect.state.code === 'ORANGE')
  const sinceQuarter = quarterStart()
  const quarterConversions = converted.filter(
    (prospect) => prospect.stateSince >= sinceQuarter,
  ).length

  const conversionDays = converted.map((prospect) =>
    daysBetween(prospect.openedAt, prospect.stateSince),
  )

  return {
    id: member.id,
    fullName: member.fullName,
    photoUrl: member.photoUrl,
    zoneNames: member.zones.map((zone) => zone.name.replace(/^Zona\s+/i, '')),
    zones: member.zones.map((zone) => ({ id: zone.id, name: zone.name })),
    openProspects: open.length,
    quarterConversions,
    conversionRate:
      open.length + converted.length === 0
        ? 0
        : converted.length / (open.length + converted.length),
    averageConversionDays: conversionDays.length
      ? Math.round(conversionDays.reduce((sum, days) => sum + days, 0) / conversionDays.length)
      : null,
    staleCount: open.filter(
      (prospect) =>
        daysBetween(
          prospect.lastAttempt?.occurredAt ?? prospect.openedAt,
          new Date().toISOString(),
        ) >= STALE_DAYS,
    ).length,
    byState: PIPELINE_COLUMNS.map((status) => ({
      status: status,
      count: open.filter((prospect) => prospect.state.code === status).length,
    })),
    openCycles: open
      .map((prospect) => ({
        prospectId: prospect.id,
        hotelName: prospect.hotel.name,
        status: prospect.state.code as TeamMemberCycle['status'],
        daysSinceAttempt: daysBetween(
          prospect.lastAttempt?.occurredAt ?? prospect.openedAt,
          new Date().toISOString(),
        ),
      }))
      /** Los más olvidados arriba: es lo que el BDC viene a vigilar. */
      .sort((a, b) => b.daysSinceAttempt - a.daysSinceAttempt),
  }
}

async function fetchOverview(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: TeamOverview } | { error: unknown }> {
  const [teamRes, prospectsRes] = await Promise.all([
    fetchWithBQ('/team'),
    fetchWithBQ({ url: '/prospects', params: { limit: 100, includeClosed: true } }),
  ])
  if (teamRes.error) return { error: teamRes.error }
  if (prospectsRes.error) return { error: prospectsRes.error }

  const members = (teamRes.data as ApiEnvelope<TeamMemberApi[]>).data
  const prospects = (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data

  const cards = members.map((member) => buildMemberCard(member, prospects))
  const allDays = cards
    .map((card) => card.averageConversionDays)
    .filter((days): days is number => days !== null)

  return {
    data: {
      memberCount: cards.length,
      openProspects: cards.reduce((sum, card) => sum + card.openProspects, 0),
      quarterConversions: cards.reduce((sum, card) => sum + card.quarterConversions, 0),
      averageConversionDays: allDays.length
        ? Math.round(allDays.reduce((sum, days) => sum + days, 0) / allDays.length)
        : null,
      members: cards,
    },
  }
}

export const teamApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTeamOverview: build.query<TeamOverview, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchOverview(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Prospect' as const, id: 'LIST' }],
    }),

    getTeamZones: build.query<Array<{ id: string; name: string }>, void>({
      query: () => '/catalogs/zones',
      transformResponse: (raw: ApiEnvelope<Array<{ id: string; name: string }>>) =>
        raw.data.map((zone) => ({ id: zone.id, name: zone.name })),
      providesTags: [{ type: 'Catalog' as const, id: 'ZONE' }],
    }),

    /**
     * `PUT /users/:id/zones` (territory:assign — BDC y Administrador): la
     * lista COMPLETA reemplaza a la anterior, como lo define el back.
     */
    setTerritory: build.mutation<unknown, { userId: string; zoneIds: string[] }>({
      query: ({ userId, zoneIds }) => ({
        url: `/users/${userId}/zones`,
        method: 'PUT',
        body: { zoneIds },
      }),
      invalidatesTags: [{ type: 'Prospect' as const, id: 'LIST' }],
    }),
  }),
})

export const { useGetTeamOverviewQuery, useGetTeamZonesQuery, useSetTerritoryMutation } = teamApi
