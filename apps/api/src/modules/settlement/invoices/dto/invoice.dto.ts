import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const generateInvoiceSchema = z.object({
  hotelId: z.uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
})

export class GenerateInvoiceDto extends createZodDto(generateInvoiceSchema) {}

export const creditSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,8}(\.\d{1,2})?$/),
  note: z.string().trim().min(1).max(500),
})

export class CreditDto extends createZodDto(creditSchema) {}
