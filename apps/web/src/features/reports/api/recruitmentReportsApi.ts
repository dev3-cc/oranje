import { baseApi } from '@/app/baseApi'
import { fetchAllPages } from '@/shared/lib/fetchAllPages'
import type { RequisitionApi } from '@/shared/types/apiContract.types'

/** Cómo va la cobertura en un hotel: sus requisiciones por estado y los lugares llenos. */
export interface HotelCoverageRow {
  hotelId: string
  hotelName: string
  queued: number
  inProgress: number
  partial: number
  covered: number
  filledSlots: number
  totalSlots: number
}

type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

/** Borrador y Eliminada no cuentan: una no ha llegado a Reclutamiento y la otra ya no existe. */
const OUT_OF_SCOPE = new Set(['APPLE_GREEN', 'PURPLE'])

function coverageByHotel(requisitions: RequisitionApi[]): HotelCoverageRow[] {
  const byHotel = new Map<string, HotelCoverageRow>()
  for (const row of requisitions) {
    if (OUT_OF_SCOPE.has(row.state.code)) continue
    const entry = byHotel.get(row.hotel.id) ?? {
      hotelId: row.hotel.id,
      hotelName: row.hotel.name,
      queued: 0,
      inProgress: 0,
      partial: 0,
      covered: 0,
      filledSlots: 0,
      totalSlots: 0,
    }
    if (row.state.code === 'GREEN') entry.queued += 1
    if (row.state.code === 'YELLOW') entry.inProgress += 1
    if (row.state.code === 'RED') entry.partial += 1
    if (row.state.code === 'LIGHT_BLUE') entry.covered += 1
    entry.filledSlots += row.filledSlots
    entry.totalSlots += row.totalSlots
    byHotel.set(row.hotel.id, entry)
  }
  return [...byHotel.values()].sort((a, b) => a.hotelName.localeCompare(b.hotelName, 'es'))
}

export const recruitmentReportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Se COMPONE de `/requisitions` (D-28): todas las páginas, no solo la primera. */
    getHotelCoverage: build.query<HotelCoverageRow[], void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const result = await fetchAllPages<RequisitionApi>(
          fetchWithBQ as FetchWithBQ,
          '/requisitions',
        )
        return 'error' in result
          ? { error: result.error as never }
          : { data: coverageByHotel(result.data) }
      },
      providesTags: [{ type: 'Requisition' as const, id: 'LIST' }],
    }),
  }),
})

export const { useGetHotelCoverageQuery } = recruitmentReportsApi
