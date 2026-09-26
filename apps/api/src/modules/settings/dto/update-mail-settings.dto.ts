import { z } from 'zod'

import { createZodDto } from '../../../common/pipes/index.js'

export const updateMailSettingsSchema = z.object({
  /**
   * `own` = nuestro SMTP; `firebase` = el respaldo, a la fuerza.
   *
   * El mismo par que acepta `ck_app_setting_value`: si algún día crece, crece
   * en los dos lados o la base rechaza la escritura.
   */
  transport: z.enum(['own', 'firebase']),
})

export class UpdateMailSettingsDto extends createZodDto(updateMailSettingsSchema) {}
