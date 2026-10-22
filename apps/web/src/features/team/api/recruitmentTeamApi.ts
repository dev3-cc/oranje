import { registerRecruitmentTeamMocks } from './recruitmentTeamMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, RecruitmentTeamMemberApi } from '@/shared/types/apiContract.types'

/**
 * Mi Equipo de la Manager de Reclutamiento. A diferencia del de Ventas, aquí
 * el backend ya trae la carga de cada persona contada (`GET /team/recruitment`):
 * contarla en el front obligaría a bajar todas las requisiciones, asignaciones
 * y altas del departamento.
 */
registerRecruitmentTeamMocks()

export const recruitmentTeamApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRecruitmentTeam: build.query<RecruitmentTeamMemberApi[], void>({
      query: () => '/team/recruitment',
      transformResponse: (response: ApiEnvelope<RecruitmentTeamMemberApi[]>) => response.data,
      providesTags: [{ type: 'RecruitmentTeam' as const, id: 'LIST' }],
    }),

    moveRecruiter: build.mutation<unknown, { memberId: string; reportsToUserId: string }>({
      query: ({ memberId, reportsToUserId }) => ({
        url: `/team/members/${memberId}/reports-to`,
        method: 'PATCH',
        body: { reportsToUserId },
      }),
      invalidatesTags: [
        { type: 'RecruitmentTeam' as const, id: 'LIST' },
        { type: 'StaffUser' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetRecruitmentTeamQuery, useMoveRecruiterMutation } = recruitmentTeamApi
