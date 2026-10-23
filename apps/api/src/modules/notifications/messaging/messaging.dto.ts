import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

// Los mismos límites que la plataforma (listContactsSchema de meta-mensajes):
// pedirle más de 100 la hace responder 400.
export const queryMessagingContactsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(100).optional(),
})

export class QueryMessagingContactsDto extends createZodDto(queryMessagingContactsSchema) {}

// El teléfono va crudo: la plataforma lo normaliza a E.164 con el país (o US
// si no viene) y responde 400 con su propio mensaje si no es válido.
const contactFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(30),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  email: z.string().trim().toLowerCase().email().max(200),
  // Los id de la plataforma son cuid: letras y números.
  tagIds: z.array(z.string().regex(/^[A-Za-z0-9]{1,64}$/)).max(50),
}

export const createMessagingContactSchema = z.object({
  firstName: contactFields.firstName,
  lastName: contactFields.lastName.optional(),
  phone: contactFields.phone,
  countryCode: contactFields.countryCode.optional(),
  email: contactFields.email.optional(),
  tagIds: contactFields.tagIds.optional(),
})

export class CreateMessagingContactDto extends createZodDto(createMessagingContactSchema) {}

// `null` borra el apellido o el email; ausente, no lo toca.
export const updateMessagingContactSchema = z
  .object({
    firstName: contactFields.firstName.optional(),
    lastName: contactFields.lastName.nullable().optional(),
    phone: contactFields.phone.optional(),
    countryCode: contactFields.countryCode.optional(),
    email: contactFields.email.nullable().optional(),
    tagIds: contactFields.tagIds.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'No hay campos para actualizar')

export class UpdateMessagingContactDto extends createZodDto(updateMessagingContactSchema) {}

// Los estados de campaña de la plataforma (enum CampaignStatus de meta-mensajes).
export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'COMPLETED',
  'PAUSED',
  'FAILED',
  'CANCELLED',
] as const

export const queryMessagingCampaignsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
})

export class QueryMessagingCampaignsDto extends createZodDto(queryMessagingCampaignsSchema) {}

// Los campos del contacto que la plataforma sabe poner en una variable.
export const CONTACT_FIELDS = ['firstName', 'lastName', 'phoneE164'] as const

const cuid = z.string().regex(/^[A-Za-z0-9]{1,64}$/)

export const createMessagingCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500).optional(),
  templateId: cuid,
  variableMapping: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('static'), value: z.string().trim().min(1).max(200) }),
        z.object({ kind: z.literal('contact'), field: z.enum(CONTACT_FIELDS) }),
      ]),
    )
    .max(20),
  /** Los destinatarios: quien tenga TODAS estas etiquetas (Oranje, Hotel, Estado). */
  tagIds: z.array(cuid).min(1).max(10),
})

export class CreateMessagingCampaignDto extends createZodDto(createMessagingCampaignSchema) {}
