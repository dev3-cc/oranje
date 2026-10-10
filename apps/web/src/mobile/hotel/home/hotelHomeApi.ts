import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope, TimesheetApi } from '@/shared/types/apiContract.types'

/**
 * Cuántos timesheets esperan la aprobación del Manager (el Supervisor ya los
 * envió: `PENDING_APPROVAL`, D-09). El API recorta por alcance —hotel, y
 * departamento salvo el Manager General— y responde la primera página: es
 * un conteo para el Inicio, no la bandeja.
 */
export const hotelHomeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    appPendingTimesheets: build.query<number, void>({
      query: () => '/timesheets',
      transformResponse: (raw: ApiEnvelope<TimesheetApi[]>) =>
        raw.data.filter((sheet) => sheet.status === 'PENDING_APPROVAL').length,
      providesTags: [{ type: 'Timesheet' as const, id: 'LIST' }],
    }),
  }),
})

export const { useAppPendingTimesheetsQuery } = hotelHomeApi
