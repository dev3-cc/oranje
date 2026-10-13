import { registerPaymentLimitsMocks } from './paymentLimitsMocks'

import { baseApi } from '@/app/baseApi'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

/** Horas `HH:mm` en la zona de cada hotel. Los días son fijos por el ciclo de pago. */
export interface PaymentLimits {
  /** Miércoles: hasta aquí el Manager de Área aprueba las horas. */
  approvalDeadline: string
  /** Miércoles: lo aprobado hasta aquí se paga ese día. */
  paymentCut: string
  /** Jueves: paga lo que se aprobó después del corte. */
  emergencySend: string
  /** Sábado: el correo de estado de horas al Supervisor y al Manager de Área. */
  saturdayNotice: string
}

registerPaymentLimitsMocks()

export const paymentLimitsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPaymentLimits: build.query<PaymentLimits, void>({
      query: () => '/settings/payment-limits',
      transformResponse: (raw: ApiEnvelope<PaymentLimits>) => raw.data,
      providesTags: ['PaymentLimits'],
    }),

    updatePaymentLimits: build.mutation<PaymentLimits, Partial<PaymentLimits>>({
      query: (body) => ({ url: '/settings/payment-limits', method: 'PATCH', body }),
      transformResponse: (raw: ApiEnvelope<PaymentLimits>) => raw.data,
      invalidatesTags: ['PaymentLimits'],
    }),
  }),
})

export const { useGetPaymentLimitsQuery, useUpdatePaymentLimitsMutation } = paymentLimitsApi
