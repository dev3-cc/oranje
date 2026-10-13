import type { PaymentLimits } from './paymentLimitsApi'

import { registerMockRoutes, type MockRoute } from '@/shared/lib/mockBaseQuery'
import type { ApiEnvelope } from '@/shared/types/apiContract.types'

const limites: PaymentLimits = {
  approvalDeadline: '11:00',
  paymentCut: '16:00',
  emergencySend: '11:00',
  saturdayNotice: '09:00',
}

const routes: readonly MockRoute[] = [
  {
    method: 'GET',
    path: '/settings/payment-limits',
    resolve: (): ApiEnvelope<PaymentLimits> => ({ data: { ...limites } }),
  },
  {
    method: 'PATCH',
    path: '/settings/payment-limits',
    resolve: ({ body }): ApiEnvelope<PaymentLimits> => {
      Object.assign(limites, body as Partial<PaymentLimits>)

      return { data: { ...limites } }
    },
  },
]

export function registerPaymentLimitsMocks(): void {
  registerMockRoutes(routes)
}
