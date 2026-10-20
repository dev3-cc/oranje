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
  // weekStartDay/weekEndDay/overtimePayMultiplier NO se piden aquí: el
  // contrato los hereda del Hotel (datos contables capturados al dar de
  // alta) y no los vuelve a preguntar (decisión de Hugo, 2026-10-07).
  overtimeBillMultiplier: multiplier.default(1.5),
  holidayBillMultiplier: multiplier.default(2),
  holidayPayMultiplier: multiplier.default(1),
  deductsMeals: z.boolean().default(false),
  splitsInvoiceByMonth: z.boolean().default(false),
  rates: z.array(rateSchema).min(1).max(50),
})

export class CreateContractDto extends createZodDto(createContractSchema) {}

export const upsertRateSchema = rateSchema

export class UpsertRateDto extends createZodDto(upsertRateSchema) {}

/** Mismo cuerpo que el de la Propuesta: multipart, el PDF llega aparte por Multer. */
export const sendContractEmailSchema = z.object({
  to: z.string().trim().email(),
  note: z.string().trim().max(2000).optional(),
})

export class SendContractEmailDto extends createZodDto(sendContractEmailSchema) {}
