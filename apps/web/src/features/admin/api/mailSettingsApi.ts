import { registerMailSettingsMocks } from './mailSettingsMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** `own` = nuestro servidor; `firebase` = el respaldo, a la fuerza. */
export type MailTransport = 'own' | 'firebase'

registerMailSettingsMocks()

export interface MailDeliveryRow {
  template: string
  toEmail: string
  transport: string
  status: string
  error: string | null
  createdAt: string
}

export interface MailSettings {
  transport: MailTransport
  /** Si este ambiente tiene el SMTP configurado. Sin eso el interruptor no puede nada. */
  configured: boolean
  /** Si AHORA MISMO el correo sale por nuestro servidor (las dos condiciones juntas). */
  sendingWithOwnServer: boolean
  updatedAt: string | null
  summary: { days: number; own: number; fallback: number; failed: number }
  recent: MailDeliveryRow[]
}

export const mailSettingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMailSettings: build.query<MailSettings, void>({
      query: () => '/settings/mail',
      transformResponse: (raw: ApiEnvelope<MailSettings>) => raw.data,
      providesTags: ['MailSettings'],
    }),

    setMailTransport: build.mutation<MailSettings, MailTransport>({
      query: (transport) => ({ url: '/settings/mail', method: 'PATCH', body: { transport } }),
      transformResponse: (raw: ApiEnvelope<MailSettings>) => raw.data,
      invalidatesTags: ['MailSettings'],
    }),
  }),
})

export const { useGetMailSettingsQuery, useSetMailTransportMutation } = mailSettingsApi
