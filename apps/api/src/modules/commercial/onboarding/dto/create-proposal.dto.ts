import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

const rate = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,4})?$/)
  .optional()

/** Dos decimales, como el contrato: el cuadro se copia tal cual al firmar. */
const money = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/)

export const proposalRateSchema = z.object({
  catalogPositionId: z.uuid(),
  payRate: money,
  billRate: money,
})

export const createProposalSchema = z.object({
  /** Etiqueta corta del ciclo; el front la exige, el DTO la deja opcional
      porque un PATCH puede seguir sin tocarla. */
  title: z.string().trim().min(1).max(200).optional(),
  servicesNote: z.string().trim().min(1).max(4000).optional(),
  /** Campos del machote aprobado de la propuesta (2026-10-19), todos libres. */
  propertyName: z.string().trim().max(200).optional(),
  preparedDate: z.string().trim().max(40).optional(),
  brandManagementCompany: z.string().trim().max(200).optional(),
  cityState: z.string().trim().max(200).optional(),
  contactName: z.string().trim().max(200).optional(),
  senderPhone: z.string().trim().max(40).optional(),
  senderEmail: z.string().trim().email().max(200).optional(),
  /**
   * El cuadro de tarifas por puesto (el Exhibit "A" del contrato). Opcional
   * porque un borrador recién abierto todavía no tiene renglones; para ENVIAR
   * la propuesta sí se exige al menos uno.
   */
  rates: z.array(proposalRateSchema).max(50).optional(),
  /** @deprecated Tarifa global, en retirada: el cuadro por puesto la sustituye. */
  payRate: rate,
  /** @deprecated Tarifa global, en retirada: el cuadro por puesto la sustituye. */
  billRate: rate,
})

export class CreateProposalDto extends createZodDto(createProposalSchema) {}
