import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const passwordResetSchema = z.object({
  email: z.email().trim().toLowerCase().max(255),
})

export class PasswordResetDto extends createZodDto(passwordResetSchema) {}
