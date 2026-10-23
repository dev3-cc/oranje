import { registerMessagingTemplatesMocks } from './messagingTemplatesMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

registerMessagingTemplatesMocks()

/** Los estados que Meta le da a una plantilla. */
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'

/** Cómo las clasifica Meta: define para qué se pueden usar y cuánto cuestan. */
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

export interface MessagingTemplate {
  id: string
  name: string
  category: TemplateCategory
  /** Código de Meta: `es`, `es_MX`, `en_US`… */
  language: string
  status: TemplateStatus
  variableCount: number
  /** El texto del mensaje, con sus `{{1}}`; null si la plantilla no trae cuerpo. */
  body: string | null
  rejectionReason: string | null
  syncedAt: string
}

export type MessagingTemplates =
  { configured: false } | { configured: true; templates: MessagingTemplate[] }

export interface TemplatesSyncResult {
  synced: number
  created: number
  updated: number
}

export const messagingTemplatesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMessagingTemplates: build.query<MessagingTemplates, void>({
      query: () => '/messaging/templates',
      transformResponse: (raw: ApiEnvelope<MessagingTemplates>) => raw.data,
      providesTags: ['Messaging'],
    }),
    /* Invalida todo Mensajería: el Panel también cuenta las plantillas. */
    syncMessagingTemplates: build.mutation<TemplatesSyncResult, void>({
      query: () => ({ url: '/messaging/templates/sync', method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<TemplatesSyncResult>) => raw.data,
      invalidatesTags: ['Messaging'],
    }),
  }),
})

export const { useGetMessagingTemplatesQuery, useSyncMessagingTemplatesMutation } =
  messagingTemplatesApi
