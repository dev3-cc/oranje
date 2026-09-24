import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const positionSchema = z.object({
  catalogPositionId: z.uuid(),
  hiringModalityId: z.uuid(),
  hotelDepartmentId: z.uuid(),
  englishLevelId: z.uuid().optional(),
  quantity: z.number().int().min(1).max(200),
  startDate: z.coerce.date(),
  // Deja de ser opcional: sin Horario, la posición no puede armar el turno
  // virtual que hoy abre el Timesheet (beta «Ponche por Horario», fecha
  // indefinida — Reglas de Negocio, «Mecanismo de ponchado»).
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  notes: z.string().trim().min(1).max(1000).optional(),
})

export const createRequisitionSchema = z.object({
  hotelId: z.uuid(),
  areaManagerUserId: z.uuid().optional(),
  positions: z.array(positionSchema).min(1).max(50),
})

export class CreateRequisitionDto extends createZodDto(createRequisitionSchema) {}

// El motivo va al journal como texto: no hay catálogo de motivos para la
// Requisición y no se inventa uno para un consumidor que no existe. Es
// obligatorio desde Verde en adelante, y eso lo decide el servicio: aquí no se
// sabe en qué estado está.
export const deleteRequisitionSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
})

export class DeleteRequisitionDto extends createZodDto(deleteRequisitionSchema) {}

// El cierre (Azul claro) sigue pasando solo, en automático, al llenarse el
// último slot (RF-05) — el Líder no lo bloquea. Esto es la revisión DESPUÉS
// del hecho: un registro de que ya lo vio, con motivo obligatorio solo si
// objeta.
export const reviewClosureSchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(1).max(500).optional(),
})

export class ReviewClosureDto extends createZodDto(reviewClosureSchema) {}
