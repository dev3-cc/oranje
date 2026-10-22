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
  // De qué versión exacta de la Propuesta nace (Hugo, 2026-10-21): para el
  // hipervínculo en el detalle del contrato. Opcional por lo mismo que
  // prospectId — un contrato heredado o migrado puede no tenerla — pero los
  // dos caminos reales de la UI (alta desde Onboarding, renovar) siempre la
  // mandan.
  proposalId: z.uuid().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  // weekStartDay/weekEndDay/overtimePayMultiplier NO se piden aquí: el
  // contrato los hereda del Hotel (datos contables capturados al dar de
  // alta) y no los vuelve a preguntar (decisión de Hugo, 2026-10-07).
  overtimeBillMultiplier: multiplier.default(1.5),
  holidayBillMultiplier: multiplier.default(2),
  holidayPayMultiplier: multiplier.default(1),
  // Monto por día laborado, no un sí/no (Hugo, 2026-10-21): 0 = no se
  // descuenta. Mismo patrón money que payRate/billRate.
  mealDeductionAmount: money.default('0.00'),
  splitsInvoiceByMonth: z.boolean().default(false),
  rates: z.array(rateSchema).min(1).max(50),
  // Campos del machote del Service Agreement (Hugo, 2026-10-20): todos
  // opcionales porque un contrato recién creado puede no traerlos todavía.
  // Sin `.email()`: el campo puede llegar vacío (nada que validar como
  // formato) y es texto para un documento, no una dirección a la que se
  // manda correo.
  propertyName: z.string().trim().max(200).optional(),
  propertyAddress: z.string().trim().max(300).optional(),
  companyEmail: z.string().trim().max(200).optional(),
  serviceProviderName: z.string().trim().max(200).optional(),
  serviceProviderEmail: z.string().trim().max(200).optional(),
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

/**
 * Edición de un contrato ya creado (Hugo, 2026-10-16): el BDC lo sigue
 * actualizando seguido, no solo al nacer. `overtimePayMultiplier`,
 * `weekStartDay` y `weekEndDay` NO se editan aquí: se heredan del hotel
 * (sección "Datos contables", 2026-10-07) y cambiarlos es editar el hotel,
 * no el contrato. `validTo: null` limpia la fecha de fin (vuelve a
 * indefinido); ausente, no la toca.
 */
export const updateContractSchema = z.object({
  validTo: z.coerce.date().nullable().optional(),
  overtimeBillMultiplier: multiplier.optional(),
  holidayBillMultiplier: multiplier.optional(),
  holidayPayMultiplier: multiplier.optional(),
  mealDeductionAmount: money.optional(),
  splitsInvoiceByMonth: z.boolean().optional(),
  propertyName: z.string().trim().max(200).nullable().optional(),
  propertyAddress: z.string().trim().max(300).nullable().optional(),
  companyEmail: z.string().trim().max(200).nullable().optional(),
  serviceProviderName: z.string().trim().max(200).nullable().optional(),
  serviceProviderEmail: z.string().trim().max(200).nullable().optional(),
})

export class UpdateContractDto extends createZodDto(updateContractSchema) {}

/** Desbloquear un contrato ACTIVO pide motivo (Hugo, 2026-10-21) — mismo
    criterio que rechazar un documento o corregir una nómina ya hecha. */
export const unlockContractSchema = z.object({
  reason: z.string().trim().min(4, 'El motivo debe explicar por qué se desbloquea').max(500),
})

export class UnlockContractDto extends createZodDto(unlockContractSchema) {}
