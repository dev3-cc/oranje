import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const DOCUMENT_TYPES = ['SSN_ITIN', 'ID', 'PROOF_OF_ADDRESS', 'OTHER'] as const

export const createDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  // La ruta sale de POST /files. El prefijo evita que el expediente apunte a
  // un objeto de otra carpeta.
  filePath: z
    .string()
    .trim()
    .max(500)
    .regex(/^workers\/document\/[A-Za-z0-9._-]+$/, 'Debe ser una ruta devuelta por POST /files'),
})

export class CreateDocumentDto extends createZodDto(createDocumentSchema) {}
