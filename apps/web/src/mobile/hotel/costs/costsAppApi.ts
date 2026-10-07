import type { HotelCostPositionsResponse, HotelCostWeeksResponse } from './costsContract'
import { sampleCostPositions, sampleCostWeeks } from './costsSample'

import { baseApi } from '@/app/baseApi'
import { readApiError } from '@/shared/lib/apiError'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/**
 * Costos del hotel. Pide el endpoint REAL (`/hotel-costs`, contrato en
 * `costsContract.ts`); mientras el backend no lo publica responde 404 y la app
 * pinta DATOS DE EJEMPLO con `isSample: true`, que la pantalla anuncia en un
 * aviso. Cualquier otro error es error: no se tapa con datos ficticios.
 *
 * Cuando el backend lo publique, la app empieza a mostrar lo real sin cambiar
 * una línea. Entonces se borra `costsSample.ts` y la rama del 404.
 */

type FetchWithBQ = (
  args: string | { url: string; params?: Record<string, unknown> },
) => Promise<{ data?: unknown; error?: unknown }>

export type WithSample<T> = T & { isSample: boolean }

/** El endpoint todavía no existe en el API desplegado. */
function isNotPublished(error: unknown): boolean {
  return readApiError(error).status === 404
}

/** Las últimas 8 semanas, terminando en la actual. */
function defaultRange(): { from: string; to: string } {
  const today = new Date()
  const from = new Date(today.getTime() - 8 * 7 * 86_400_000)
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) }
}

export const costsAppApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    appHotelCostWeeks: build.query<WithSample<HotelCostWeeksResponse>, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const res = await (fetchWithBQ as FetchWithBQ)({
          url: '/hotel-costs/weeks',
          params: defaultRange(),
        })
        if (res.error) {
          if (isNotPublished(res.error)) return { data: { ...sampleCostWeeks(), isSample: true } }
          return { error: res.error as never }
        }
        const body = (res.data as ApiEnvelope<HotelCostWeeksResponse>).data
        return { data: { ...body, isSample: false } }
      },
      providesTags: [{ type: 'Timesheet' as const, id: 'COSTS' }],
    }),

    appHotelCostPositions: build.query<WithSample<HotelCostPositionsResponse>, string>({
      queryFn: async (weekStart, _api, _extra, fetchWithBQ) => {
        const res = await (fetchWithBQ as FetchWithBQ)(`/hotel-costs/weeks/${weekStart}/positions`)
        if (res.error) {
          if (isNotPublished(res.error)) {
            return { data: { ...sampleCostPositions(weekStart), isSample: true } }
          }
          return { error: res.error as never }
        }
        const body = (res.data as ApiEnvelope<HotelCostPositionsResponse>).data
        return { data: { ...body, isSample: false } }
      },
      providesTags: (_res, _err, weekStart) => [
        { type: 'Timesheet' as const, id: `COSTS_${weekStart}` },
      ],
    }),
  }),
})

export const { useAppHotelCostWeeksQuery, useAppHotelCostPositionsQuery } = costsAppApi
