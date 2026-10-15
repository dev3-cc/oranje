import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora en formato HH:mm')

export const updatePaymentLimitsSchema = z
  .object({
    approvalDeadline: hhmm.optional(),
    paymentCut: hhmm.optional(),
    emergencySend: hhmm.optional(),
    saturdayNotice: hhmm.optional(),
  })
  .strict()

export class UpdatePaymentLimitsDto extends createZodDto(updatePaymentLimitsSchema) {}
