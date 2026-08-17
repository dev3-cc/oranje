import type { TimesheetFilters, TimesheetWeek } from '../types/timesheet.types'

import { registerTimesheetMocks } from './timesheetMocks'

import { baseApi } from '@/app/baseApi'

registerTimesheetMocks()

/**
 * Timesheet semanal sobre el `createApi` único (D-12), con el tag `Timesheet`.
 *
 * La semana entera viene en una respuesta: la rejilla necesita todas las
 * columnas a la vez para dibujarse, y pedir día por día haría siete peticiones
 * para pintar una sola pantalla.
 */
export const timesheetApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTimesheetWeek: build.query<TimesheetWeek, TimesheetFilters>({
      query: ({ search, requisitionNumber, status, hotelName }) => ({
        url: '/timesheets/week',
        params: { search, requisition: requisitionNumber, status, hotel: hotelName },
      }),
      providesTags: (week) => [
        { type: 'Timesheet' as const, id: 'WEEK' },
        ...(week?.rows ?? []).map((row) => ({ type: 'Timesheet' as const, id: row.workerId })),
      ],
    }),
  }),
})

export const { useGetTimesheetWeekQuery } = timesheetApi
