import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

// Los CUATRO son PROPUESTA derivada de las fases del flujo: el vault dice que
// la tarjeta tiene status pero nunca los nombra.
export const ACCIDENT_STATUSES = [
  'REPORTED',
  'ON_SITE_CAPTURED',
  'MEDICAL_FOLLOW_UP',
  'CLOSED',
] as const

// Escenario A: lo reporta el propio colaborador desde la app y la tarjeta nace
// solo con la cabecera. `workerId` no va: sale de su cuenta.
export const reportOwnSchema = z.object({
  hotelId: z.uuid(),
  occurredAt: z.coerce.date(),
})

export class ReportOwnAccidentDto extends createZodDto(reportOwnSchema) {}

// Escenario B: lo reporta el Supervisor, que puede traer ya lo presencial. El
// servicio salta el status a ON_SITE_CAPTURED si viene completo.
export const reportSchema = reportOwnSchema.extend({
  workerId: z.uuid(),
  siteLocation: z.string().trim().min(1).max(300).optional(),
  circumstances: z.string().trim().min(1).max(2000).optional(),
  witnesses: z.string().trim().min(1).max(1000).optional(),
  immediateCare: z.string().trim().min(1).max(2000).optional(),
})

export class ReportAccidentDto extends createZodDto(reportSchema) {}

export const captureOnSiteSchema = z
  .object({
    siteLocation: z.string().trim().min(1).max(300).optional(),
    circumstances: z.string().trim().min(1).max(2000).optional(),
    witnesses: z.string().trim().min(1).max(1000).optional(),
    immediateCare: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada que capturar' })

export class CaptureOnSiteDto extends createZodDto(captureOnSiteSchema) {}

// El centro solo se acepta si hubo traslado; lo vuelve a exigir un CHECK.
export const medicalFollowUpSchema = z
  .object({
    isTransferred: z.boolean().optional(),
    medicalCenter: z.string().trim().min(1).max(200).optional(),
    diagnosis: z.string().trim().min(1).max(2000).optional(),
    disabilityDays: z.number().int().min(0).max(3650).optional(),
    medicalNotes: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada que capturar' })

export class MedicalFollowUpDto extends createZodDto(medicalFollowUpSchema) {}

export const closeSchema = z.object({
  medicalDischargeDate: z.coerce.date(),
})

export class CloseAccidentDto extends createZodDto(closeSchema) {}

export const queryAccidentsSchema = z.object({
  status: z.enum(ACCIDENT_STATUSES).optional(),
  workerId: z.uuid().optional(),
  hotelId: z.uuid().optional(),
  openOnly: z.stringbool().default(false),
})

export class QueryAccidentsDto extends createZodDto(queryAccidentsSchema) {}
