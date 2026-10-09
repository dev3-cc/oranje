import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const ASSIGNMENT_TYPES = ['FIXED', 'TEMPORARY'] as const

export const createAssignmentSchema = z
  .object({
    positionId: z.uuid(),
    /**
     * Qué lugar de la posición, cuando quien asigna lo eligió (Hugo,
     * 2026-10-09). Sin él se toma el primer libre, que es como funcionaba.
     *
     * Va el ORDINAL y no el id del slot: el ordinal es único dentro de la
     * posición (`ux_slot_position_ordinal`), así que la búsqueda queda acotada
     * a esta posición por construcción y nadie puede apuntar al slot de otra
     * requisición mandando su uuid.
     */
    slotOrdinal: z.coerce.number().int().min(1).optional(),
    workerId: z.uuid(),
    type: z.enum(ASSIGNMENT_TYPES),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((v) => v.type !== 'TEMPORARY' || v.endDate !== undefined, {
    message: 'Una asignación temporal necesita fecha de fin',
    path: ['endDate'],
  })
  .refine((v) => v.type !== 'FIXED' || v.endDate === undefined, {
    message: 'Una asignación fija no lleva fecha de fin',
    path: ['endDate'],
  })

export class CreateAssignmentDto extends createZodDto(createAssignmentSchema) {}
