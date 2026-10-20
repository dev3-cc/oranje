import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/**
 * El cuerpo multipart de "Enviar por correo" (2026-10-17): el PDF llega como
 * archivo (`file`, fuera de este DTO — Multer lo saca del cuerpo antes de que
 * Zod lo vea), `to` y `note` llegan como campos de texto del mismo form-data.
 */
export const sendProposalEmailSchema = z.object({
  to: z.string().trim().email(),
  note: z.string().trim().max(2000).optional(),
})

export class SendProposalEmailDto extends createZodDto(sendProposalEmailSchema) {}
