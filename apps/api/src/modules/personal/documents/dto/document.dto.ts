import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const DOCUMENT_TYPES = ['SSN_ITIN', 'ID', 'PROOF_OF_ADDRESS', 'OTHER'] as const

export const createDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  filePath: z.string().trim().min(1).max(500),
})

export class CreateDocumentDto extends createZodDto(createDocumentSchema) {}
