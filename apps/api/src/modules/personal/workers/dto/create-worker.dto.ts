import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const
export const EXPERIENCE_LEVELS = ['NONE', 'ONE_TO_TWO', 'THREE_TO_FIVE', 'MORE_THAN_FIVE'] as const
export const TRANSPORT_TYPES = ['OWN', 'PUBLIC', 'OTHER'] as const
export const RELATIONSHIPS = [
  'MOTHER',
  'FATHER',
  'SPOUSE',
  'SIBLING',
  'CHILD',
  'FRIEND',
  'OTHER',
] as const
export const BLOOD_TYPES = [
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
  'UNKNOWN',
] as const

export const createWorkerSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  birthDate: z.coerce.date(),
  gender: z.enum(GENDERS),
  phone: z.string().trim().min(7).max(32),
  address: z.string().trim().min(1).max(300),
  zoneId: z.uuid(),
})

export class CreateWorkerDto extends createZodDto(createWorkerSchema) {}

export const updateWorkerSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160).optional(),
    phone: z.string().trim().min(7).max(32).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    zoneId: z.uuid().optional(),
    catalogPositionId: z.uuid().nullish(),
    englishLevelId: z.uuid().nullish(),
    hiringModalityId: z.uuid().nullish(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).nullish(),
    transportType: z.enum(TRANSPORT_TYPES).nullish(),
    emergencyContactName: z.string().trim().min(1).max(160).nullish(),
    emergencyContactPhone: z.string().trim().min(7).max(32).nullish(),
    emergencyContactRelationship: z.enum(RELATIONSHIPS).nullish(),
    bloodType: z.enum(BLOOD_TYPES).nullish(),
    medicalNotes: z.string().trim().min(1).max(1000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No hay nada que cambiar' })

export class UpdateWorkerDto extends createZodDto(updateWorkerSchema) {}

export const queryWorkersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  state: z.string().trim().min(1).optional(),
  zoneId: z.uuid().optional(),
  catalogPositionId: z.uuid().optional(),
  englishLevelId: z.uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  onlyAvailable: z.coerce.boolean().default(false),
})

export class QueryWorkersDto extends createZodDto(queryWorkersSchema) {}

export const changeStateSchema = z.object({
  toState: z.string().trim().min(1).max(30),
  reasonCode: z.string().trim().min(1).max(60).optional(),
  note: z.string().trim().min(1).max(1000).optional(),
})

export class ChangeStateDto extends createZodDto(changeStateSchema) {}
