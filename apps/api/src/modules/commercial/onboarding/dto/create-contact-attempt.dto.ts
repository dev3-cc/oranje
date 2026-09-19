import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const ATTEMPT_TYPES = ['COLD_VISIT', 'CALL', 'EMAIL'] as const
export const OUTCOMES = ['NO_ANSWER', 'INTERESTED', 'NOT_INTERESTED', 'MEETING_SET'] as const

export const createContactAttemptSchema = z.object({
  attemptType: z.enum(ATTEMPT_TYPES),
  outcome: z.enum(OUTCOMES),
  hotelContactId: z.uuid().optional(),
  occurredAt: z.coerce.date().optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
})

export class CreateContactAttemptDto extends createZodDto(createContactAttemptSchema) {}
