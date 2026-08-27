import type {
  DashboardOverview,
  FunnelBucket,
  MyActivity,
  StaleProspect,
  TeamMemberProgress,
} from '../types/dashboard.types'

import { registerDashboardMocks } from './dashboardMocks'

import { baseApi } from '@/app/baseApi'
import type { OnboardingStatus } from '@/shared/constants/onboardingStatus'
import type {
  ApiEnvelope,
  HotelApi,
  PaginatedEnvelope,
  ProspectApi,
  TeamMemberApi,
} from '@/shared/types/apiContract.types'

/**
 * El contrato real no tiene `GET /dashboard`: las cifras se COMPONEN de tres
 * recursos que sí existen — `/me` (dueño y zonas), `/prospects` con los ciclos
 * cerrados incluidos (embudo, conversión, inactivos) y `/hotels` (clientes).
 * El mismo patrón de Mi Territorio. Cuando el volumen lo pida, esto se muda a
 * un endpoint agregador en el backend; la pantalla no se entera.
 */
registerDashboardMocks()

/** `fetchWithBQ` de un `queryFn`: el tipo exacto no está exportado por RTK. */
type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

interface MeApi {
  id: string
  fullName: string
  role: { code: string; name: string }
  zones: Array<{ id: string; name: string }>
}

const STALE_DAYS = 7
const MS_PER_DAY = 86_400_000

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY))
}

function buildFunnel(open: ProspectApi[]): FunnelBucket[] {
  const buckets = new Map<string, { count: number; order: number }>()
  for (const prospect of open) {
    const entry = buckets.get(prospect.state.code)
    if (entry) {
      entry.count += 1
    } else {
      buckets.set(prospect.state.code, { count: 1, order: prospect.state.displayOrder })
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([status, { count }]) => ({ status: status as OnboardingStatus, count }))
}

function buildStaleList(open: ProspectApi[]): StaleProspect[] {
  return open
    .map((prospect) => ({
      prospectId: prospect.id,
      hotelName: prospect.hotel.name,
      /** Sin intentos aún, la inactividad corre desde que el ciclo abrió. */
      daysWithoutAttempt: daysSince(prospect.lastAttempt?.occurredAt ?? prospect.openedAt),
      status: prospect.state.code as OnboardingStatus,
    }))
    .filter((prospect) => prospect.daysWithoutAttempt >= STALE_DAYS)
    .sort((a, b) => b.daysWithoutAttempt - a.daysWithoutAttempt)
    .slice(0, 6)
}

async function fetchOverview(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: DashboardOverview } | { error: unknown }> {
  const [meRes, prospectsRes, hotelsRes] = await Promise.all([
    fetchWithBQ('/me'),
    fetchWithBQ({ url: '/prospects', params: { limit: 100, includeClosed: true } }),
    fetchWithBQ({ url: '/hotels', params: { limit: 100 } }),
  ])
  if (meRes.error) return { error: meRes.error }
  if (prospectsRes.error) return { error: prospectsRes.error }
  if (hotelsRes.error) return { error: hotelsRes.error }

  const me = (meRes.data as ApiEnvelope<MeApi>).data
  const prospects = (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data
  const hotels = (hotelsRes.data as PaginatedEnvelope<HotelApi>).data

  const open = prospects.filter((prospect) => prospect.isOpen)
  const staleList = buildStaleList(open)

  /**
   * Conversión = ciclos que llegaron a NARANJA sobre ciclos terminados
   * (convertidos + cerrados sin convertir). Los abiertos no cuentan: todavía
   * pueden convertir.
   */
  const converted = prospects.filter((prospect) => prospect.state.code === 'ORANGE')
  const closedWithoutConverting = prospects.filter(
    (prospect) => prospect.closedAt !== null && prospect.state.code !== 'ORANGE',
  )
  const finished = converted.length + closedWithoutConverting.length
  const conversionRate = finished === 0 ? 0 : converted.length / finished

  /** Días de la apertura del ciclo a NARANJA (su `stateSince` es la conversión). */
  const conversionDays = converted.map((prospect) =>
    Math.max(
      0,
      Math.round(
        (new Date(prospect.stateSince).getTime() - new Date(prospect.openedAt).getTime()) /
          MS_PER_DAY,
      ),
    ),
  )
  const averageConversionDays = conversionDays.length
    ? Math.round(conversionDays.reduce((sum, days) => sum + days, 0) / conversionDays.length)
    : 0

  return {
    data: {
      owner: { name: me.fullName, roleLabel: me.role.name },
      scope: {
        zones: me.zones.length ? me.zones.map((zone) => zone.name) : ['todas'],
        periodLabel: 'histórico',
      },
      metrics: {
        openProspects: open.length,
        staleProspects: staleList.length,
        conversionRate,
        averageConversionDays,
        activeClients: hotels.filter((hotel) => hotel.isClient).length,
      },
      funnel: buildFunnel(open),
      staleProspects: staleList,
    },
  }
}

/** Las últimas 8 semanas como cubetas [lunes, lunes+7). */
function weeklyBuckets(): Array<{ start: Date; label: string }> {
  const now = new Date()
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return Array.from({ length: 8 }, (_item, index) => {
    const start = new Date(monday)
    start.setDate(start.getDate() - (7 - index - 1) * 7)
    return {
      start,
      label: start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    }
  })
}

function countPerWeek(dates: string[], buckets: Array<{ start: Date }>): number[] {
  return buckets.map((bucket, index) => {
    const end = new Date(bucket.start)
    end.setDate(end.getDate() + 7)
    const isLast = index === buckets.length - 1
    return dates.filter((iso) => {
      const at = new Date(iso)
      return at >= bucket.start && (isLast || at < end)
    }).length
  })
}

/**
 * La actividad de la persona, derivada del MISMO contrato (D-28): sus ciclos
 * abiertos por semana y sus conversiones por semana — el endpoint de
 * actividad histórica (`GET /me/activity`) sigue pendiente en el back.
 */
async function fetchMyActivity(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: MyActivity } | { error: unknown }> {
  const res = await fetchWithBQ({ url: '/prospects', params: { limit: 100, includeClosed: true } })
  if (res.error) return { error: res.error }

  const prospects = (res.data as PaginatedEnvelope<ProspectApi>).data
  const buckets = weeklyBuckets()
  const converted = prospects.filter((prospect) => prospect.state.code === 'ORANGE')

  return {
    data: {
      weekLabels: buckets.map((bucket) => bucket.label),
      openedPerWeek: countPerWeek(
        prospects.map((prospect) => prospect.openedAt),
        buckets,
      ),
      convertedPerWeek: countPerWeek(
        converted.map((prospect) => prospect.stateSince),
        buckets,
      ),
      totalOpen: prospects.filter((prospect) => prospect.isOpen).length,
      totalConverted: converted.length,
    },
  }
}

/**
 * El avance de la gente a cargo (`reports_to`): si nadie le reporta al que
 * pregunta —o su rol ni siquiera puede ver `/team` (403)— la lista va VACÍA
 * y la tarjeta no se pinta. Composición mínima, hermana de Mi Equipo.
 */
async function fetchTeamProgress(
  fetchWithBQ: FetchWithBQ,
): Promise<{ data: TeamMemberProgress[] } | { error: unknown }> {
  const teamRes = await fetchWithBQ('/team')
  if (teamRes.error) {
    const status = (teamRes.error as { status?: number }).status
    if (status === 403) return { data: [] }
    return { error: teamRes.error }
  }

  const prospectsRes = await fetchWithBQ({
    url: '/prospects',
    params: { limit: 100, includeClosed: true },
  })
  if (prospectsRes.error) return { error: prospectsRes.error }

  const members = (teamRes.data as ApiEnvelope<TeamMemberApi[]>).data
  const prospects = (prospectsRes.data as PaginatedEnvelope<ProspectApi>).data

  return {
    data: members.map((member) => {
      const own = prospects.filter((prospect) => prospect.owner.id === member.id)
      const open = own.filter((prospect) => prospect.isOpen && prospect.state.code !== 'ORANGE')
      const converted = own.filter((prospect) => prospect.state.code === 'ORANGE')
      const finished =
        converted.length +
        own.filter((p) => p.closedAt !== null && p.state.code !== 'ORANGE').length
      return {
        id: member.id,
        fullName: member.fullName,
        openProspects: open.length,
        conversions: converted.length,
        conversionRate: finished === 0 ? 0 : converted.length / finished,
      }
    }),
  }
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboardOverview: build.query<DashboardOverview, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchOverview(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      /**
       * Todas sus cifras se derivan de prospectos y hoteles: cambiar un
       * semáforo o registrar un intento ya invalida esta consulta.
       */
      providesTags: [
        { type: 'Prospect', id: 'LIST' },
        { type: 'Hotel', id: 'LIST' },
      ],
    }),

    getMyActivity: build.query<MyActivity, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchMyActivity(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),

    getTeamProgress: build.query<TeamMemberProgress[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchTeamProgress(fetchWithBQ as FetchWithBQ)
        return 'error' in result ? { error: result.error as never } : { data: result.data }
      },
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),
  }),
})

export const { useGetDashboardOverviewQuery, useGetMyActivityQuery, useGetTeamProgressQuery } =
  dashboardApi
