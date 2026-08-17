import type { DashboardOverview } from '../types/dashboard.types'

import { registerDashboardMocks } from './dashboardMocks'

import { baseApi } from '@/app/baseApi'

/**
 * Dashboard del rol sobre el `createApi` único (D-12).
 *
 * Se etiqueta con `Prospect`/`LIST` porque todas sus cifras se derivan de los
 * prospectos: cambiar un semáforo o registrar un intento mueve el embudo y la
 * lista de inactivos, así que esas mutaciones ya lo invalidan sin saber que
 * esta pantalla existe.
 */
registerDashboardMocks()

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboardOverview: build.query<DashboardOverview, void>({
      query: () => '/dashboard',
      providesTags: [{ type: 'Prospect', id: 'LIST' }],
    }),
  }),
})

export const { useGetDashboardOverviewQuery } = dashboardApi
