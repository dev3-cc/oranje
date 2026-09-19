import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

export const PLATFORMS = ['WEB', 'ANDROID', 'IOS'] as const

export const registerDeviceSchema = z.object({
  fcmToken: z.string().trim().min(1).max(500),
  platform: z.enum(PLATFORMS),
})

export class RegisterDeviceDto extends createZodDto(registerDeviceSchema) {}

export const queryNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  unreadOnly: z.stringbool().default(false),
})

export class QueryNotificationsDto extends createZodDto(queryNotificationsSchema) {}
