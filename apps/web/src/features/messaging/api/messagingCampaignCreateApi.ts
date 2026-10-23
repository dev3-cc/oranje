import type { MessagingCampaign } from './messagingCampaignsApi'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Los datos del contacto que la plataforma sabe poner en una variable. */
export type ContactField = 'firstName' | 'lastName' | 'phoneE164'

export type VariableMapping =
  { kind: 'static'; value: string } | { kind: 'contact'; field: ContactField }

export interface CreateMessagingCampaignInput {
  name: string
  description?: string
  templateId: string
  /** En orden: el primero es `{{1}}`. */
  variableMapping: VariableMapping[]
  /** Los destinatarios: quien tenga TODAS estas etiquetas. */
  tagIds: string[]
}

export const messagingCampaignCreateApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* Invalida Mensajería: la lista de campañas y el Panel. */
    createMessagingCampaign: build.mutation<MessagingCampaign, CreateMessagingCampaignInput>({
      query: (body) => ({ url: '/messaging/campaigns', method: 'POST', body }),
      transformResponse: (raw: ApiEnvelope<MessagingCampaign>) => raw.data,
      invalidatesTags: ['Messaging'],
    }),
  }),
})

export const { useCreateMessagingCampaignMutation } = messagingCampaignCreateApi
