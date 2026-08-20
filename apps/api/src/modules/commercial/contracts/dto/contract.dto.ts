import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

const money = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/)

const multiplier = z.number().min(1).max(5)

export const rateSchema = z.object({
  catalogPositionId: z.uuid(),
  payRate: money,
  billRate: money,
})

export const createContractSchema = z.object({
  hotelId: z.uuid(),
  prospectId: z.uuid().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  weekStartDay: z.number().int().min(0).max(6).default(1),
  weekEndDay: z.number().int().min(0).max(6).default(0),
  overtimeBillMultiplier: multiplier.default(1.5),
  overtimePayMultiplier: multiplier.default(1),
  holidayBillMultiplier: multiplier.default(2),
  holidayPayMultiplier: multiplier.default(1),
  deductsMeals: z.boolean().default(false),
  splitsInvoiceByMonth: z.boolean().default(false),
  rates: z.array(rateSchema).min(1).max(50),
})

export class CreateContractDto extends createZodDto(createContractSchema) {}

export const upsertRateSchema = rateSchema

export class UpsertRateDto extends createZodDto(upsertRateSchema) {}
