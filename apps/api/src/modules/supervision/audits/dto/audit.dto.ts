import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

// Las dos auditorías del Supervisor. Un solo mecanismo, discriminado por tipo
// (ver migración: `ck_audit_type`).
export const AUDIT_TYPES = ['PERSONAL_PRESENTATION', 'ENVIRONMENT'] as const

// CUMPLE | NO | N/A — igual que `ck_audit_response_value`.
export const RESPONSE_VALUES = ['CUMPLE', 'NO', 'N/A'] as const

const responseSchema = z.object({
  checklistItemId: z.uuid(),
  value: z.enum(RESPONSE_VALUES),
})

export const createAuditSchema = z.object({
  auditType: z.enum(AUDIT_TYPES),
  hotelId: z.uuid(),
  // Obligatorio solo en PERSONAL_PRESENTATION; el servicio lo exige/rechaza
  // según el tipo — el CHECK de la base lo vuelve a exigir de todos modos.
  workerId: z.uuid().optional(),
  observations: z.string().trim().min(1).max(2000).optional(),
  responses: z.array(responseSchema).min(1).max(100),
})

export class CreateAuditDto extends createZodDto(createAuditSchema) {}

// Solo los reactivos que cambian, no hace falta mandar todos.
export const updateAuditSchema = z
  .object({
    observations: z.string().trim().min(1).max(2000).optional(),
    responses: z.array(responseSchema).min(1).max(100).optional(),
  })
  .refine((v) => v.observations !== undefined || v.responses !== undefined, {
    message: 'No hay nada que corregir',
  })

export class UpdateAuditDto extends createZodDto(updateAuditSchema) {}

export const queryAuditsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hotelId: z.uuid().optional(),
  workerId: z.uuid().optional(),
  auditType: z.enum(AUDIT_TYPES).optional(),
})

export class QueryAuditsDto extends createZodDto(queryAuditsSchema) {}

export const queryLastPerWorkerSchema = z.object({
  hotelId: z.uuid(),
})

export class QueryLastPerWorkerDto extends createZodDto(queryLastPerWorkerSchema) {}
