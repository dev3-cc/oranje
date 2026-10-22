import { registerHotelTeamMocks } from './hotelTeamMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, HotelTeamMemberApi } from '@/shared/types/apiContract.types'

/**
 * Mi Equipo del Hotel (Manager General): sus Managers de Área y Supervisores,
 * con los tres números que ya cuenta el servidor (`GET /team/hotel`).
 */
registerHotelTeamMocks()

export const hotelTeamApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getHotelTeam: build.query<HotelTeamMemberApi[], void>({
      query: () => '/team/hotel',
      transformResponse: (response: ApiEnvelope<HotelTeamMemberApi[]>) => response.data,
      providesTags: [{ type: 'HotelTeam' as const, id: 'LIST' }],
    }),
  }),
})

export const { useGetHotelTeamQuery } = hotelTeamApi
