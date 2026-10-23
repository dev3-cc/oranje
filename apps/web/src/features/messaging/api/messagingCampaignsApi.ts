import type { CampaignStatus } from './messagingApi'
import { registerMessagingCampaignsMocks } from './messagingCampaignsMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

registerMessagingCampaignsMocks()

export interface MessagingCampaign {
  id: string
  name: string
  description: string | null
  templateName: string | null
  status: CampaignStatus
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export type MessagingCampaigns =
  | { configured: false }
  | {
      configured: true
      campaigns: MessagingCampaign[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }

export interface MessagingCampaignsArgs {
  page: number
  /** Vacío: todos los estados. */
  status: CampaignStatus | ''
}

export type CampaignAction = 'send' | 'pause' | 'resume' | 'cancel'

export const messagingCampaignsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMessagingCampaigns: build.query<MessagingCampaigns, MessagingCampaignsArgs>({
      query: ({ page, status }) => ({
        url: '/messaging/campaigns',
        params: { page, limit: 20, ...(status === '' ? {} : { status }) },
      }),
      transformResponse: (raw: ApiEnvelope<MessagingCampaigns>) => raw.data,
      providesTags: ['Messaging'],
    }),
    /* Invalida todo Mensajería: el Panel también muestra las últimas campañas. */
    runMessagingCampaignAction: build.mutation<null, { id: string; action: CampaignAction }>({
      query: ({ id, action }) => ({
        url: `/messaging/campaigns/${encodeURIComponent(id)}/${action}`,
        method: 'POST',
      }),
      invalidatesTags: ['Messaging'],
    }),
  }),
})

export const { useGetMessagingCampaignsQuery, useRunMessagingCampaignActionMutation } =
  messagingCampaignsApi
