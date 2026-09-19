import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

export const PURPOSES = ['WORKER_PHOTO', 'WORKER_DOCUMENT', 'PUNCH_PHOTO', 'USER_PHOTO'] as const

export type Purpose = (typeof PURPOSES)[number]

export const uploadFileSchema = z.object({
  purpose: z.enum(PURPOSES),
})

export class UploadFileDto extends createZodDto(uploadFileSchema) {}
