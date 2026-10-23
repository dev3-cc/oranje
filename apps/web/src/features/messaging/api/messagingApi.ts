import { registerMessagingMocks } from './messagingMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

registerMessagingMocks()

/** Los estados de una campaña en la plataforma de mensajería (meta-mensajes). */
export type CampaignStatus =
  'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'CANCELLED'

export interface RecentCampaign {
  id: string
  name: string
  templateName: string | null
  status: CampaignStatus
  sentCount: number
  totalRecipients: number
  createdAt: string
}

/** Sin `configured`, este ambiente no tiene la plataforma conectada. */
export type MessagingOverview =
  | { configured: false }
  | {
      configured: true
      contacts: number
      templates: number
      campaigns: number
      recentCampaigns: RecentCampaign[]
    }

export interface MessagingContact {
  id: string
  firstName: string
  lastName: string | null
  /** E.164 sin el `+`, como lo guarda la plataforma. */
  phone: string
  email: string | null
  optedOut: boolean
  tags: Array<{ id: string; name: string; color: string | null }>
}

export type MessagingContacts =
  | { configured: false }
  | {
      configured: true
      contacts: MessagingContact[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }

export interface MessagingContactsQuery {
  page: number
  search: string
}

export interface MessagingTag {
  id: string
  name: string
  color: string | null
  contactCount: number
}

export type MessagingTags = { configured: false } | { configured: true; tags: MessagingTag[] }

/**
 * Lo que se manda al crear o editar. El teléfono va crudo y el país (ISO de
 * dos letras) le dice a la plataforma cómo leerlo; sin país, lo lee como US.
 * `null` borra el apellido o el email al editar.
 */
export interface MessagingContactInput {
  firstName?: string
  lastName?: string | null
  phone?: string
  countryCode?: string
  email?: string | null
  tagIds?: string[]
}

export const messagingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMessagingOverview: build.query<MessagingOverview, void>({
      query: () => '/messaging/overview',
      transformResponse: (raw: ApiEnvelope<MessagingOverview>) => raw.data,
      providesTags: ['Messaging'],
    }),
    getMessagingContacts: build.query<MessagingContacts, MessagingContactsQuery>({
      query: ({ page, search }) => ({
        url: '/messaging/contacts',
        params: search === '' ? { page } : { page, search },
      }),
      transformResponse: (raw: ApiEnvelope<MessagingContacts>) => raw.data,
      providesTags: ['Messaging'],
    }),
    getMessagingTags: build.query<MessagingTags, void>({
      query: () => '/messaging/tags',
      transformResponse: (raw: ApiEnvelope<MessagingTags>) => raw.data,
      providesTags: ['Messaging'],
    }),
    /* Cada escritura invalida todo Mensajería: un contacto nuevo cambia la
       lista, el total del Panel y la cuenta de cada etiqueta. */
    createMessagingContact: build.mutation<MessagingContact, MessagingContactInput>({
      query: (body) => ({ url: '/messaging/contacts', method: 'POST', body }),
      transformResponse: (raw: ApiEnvelope<MessagingContact>) => raw.data,
      invalidatesTags: ['Messaging'],
    }),
    updateMessagingContact: build.mutation<
      MessagingContact,
      { id: string; body: MessagingContactInput }
    >({
      query: ({ id, body }) => ({
        url: `/messaging/contacts/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (raw: ApiEnvelope<MessagingContact>) => raw.data,
      invalidatesTags: ['Messaging'],
    }),
    optOutMessagingContact: build.mutation<MessagingContact, string>({
      query: (id) => ({
        url: `/messaging/contacts/${encodeURIComponent(id)}/opt-out`,
        method: 'POST',
      }),
      transformResponse: (raw: ApiEnvelope<MessagingContact>) => raw.data,
      invalidatesTags: ['Messaging'],
    }),
    deleteMessagingContact: build.mutation<void, string>({
      query: (id) => ({ url: `/messaging/contacts/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: ['Messaging'],
    }),
  }),
})

export const { useGetMessagingOverviewQuery } = messagingApi
export const { useGetMessagingContactsQuery } = messagingApi
export const {
  useGetMessagingTagsQuery,
  useCreateMessagingContactMutation,
  useUpdateMessagingContactMutation,
  useOptOutMessagingContactMutation,
  useDeleteMessagingContactMutation,
} = messagingApi
