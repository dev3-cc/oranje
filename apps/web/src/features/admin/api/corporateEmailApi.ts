import { registerCorporateEmailMocks } from './corporateEmailMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

registerCorporateEmailMocks()

/** Un colaborador con correo corporativo en Oranje, y si el buzón REAL ya existe en cPanel. */
export interface CorporateEmailRow {
  workerId: string
  workerName: string
  /** URL firmada de la foto (D-30); null sin foto o si el firmado falla. */
  photoUrl: string | null
  email: string
  /** La cuenta de Oranje, no el semáforo del colaborador. */
  isActive: boolean
  mailboxExists: boolean
}

/** Solo llega una vez, al crear o resetear: cPanel no permite "revelar" una contraseña ya puesta. */
export interface MailboxCredential {
  email: string
  password: string
}

export const corporateEmailApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCorporateEmails: build.query<CorporateEmailRow[], void>({
      query: () => '/corporate-email',
      transformResponse: (raw: ApiEnvelope<CorporateEmailRow[]>) => raw.data,
      providesTags: ['CorporateEmail'],
    }),

    createMailbox: build.mutation<MailboxCredential, string>({
      query: (workerId) => ({ url: `/corporate-email/${workerId}/mailbox`, method: 'POST' }),
      transformResponse: (raw: ApiEnvelope<MailboxCredential>) => raw.data,
      invalidatesTags: ['CorporateEmail'],
    }),

    resetMailboxPassword: build.mutation<MailboxCredential, string>({
      query: (workerId) => ({
        url: `/corporate-email/${workerId}/mailbox/reset-password`,
        method: 'POST',
      }),
      transformResponse: (raw: ApiEnvelope<MailboxCredential>) => raw.data,
    }),

    deleteMailbox: build.mutation<void, string>({
      query: (workerId) => ({ url: `/corporate-email/${workerId}/mailbox`, method: 'DELETE' }),
      invalidatesTags: ['CorporateEmail'],
    }),
  }),
})

export const {
  useGetCorporateEmailsQuery,
  useCreateMailboxMutation,
  useResetMailboxPasswordMutation,
  useDeleteMailboxMutation,
} = corporateEmailApi
