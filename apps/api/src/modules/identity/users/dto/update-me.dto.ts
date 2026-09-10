import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

export const LOCALES = ['es', 'en'] as const

/** Lo unico que la persona edita de si misma por ahora: el idioma (D-36). */
export const updateMeSchema = z.object({ locale: z.enum(LOCALES) }).strict()

export class UpdateMeDto extends createZodDto(updateMeSchema) {}
