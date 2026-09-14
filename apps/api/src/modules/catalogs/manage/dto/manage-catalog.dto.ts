import { z } from 'zod'

import { createZodDto } from '../../../../common/pipes/index.js'

/**
 * Alta y edición de una fila de catálogo. El `code` NO viaja: se deriva del
 * nombre en el servidor (mayúsculas, sin acentos, no-alfanumérico → `_`), así
 * dos altas con el mismo nombre chocan por código y no por mayúsculas.
 * `hotelDepartmentId` solo aplica a posiciones: cada puesto es de UN
 * departamento (catálogo Posiciones del vault). `statusLightCode` solo aplica
 * a motivos: cada motivo pertenece a UN semáforo, referido por su código
 * (estable entre ambientes) y no por su uuid interno.
 */
export const createCatalogItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  hotelDepartmentId: z.string().uuid().optional(),
  statusLightCode: z.string().trim().min(1).optional(),
})

export const updateCatalogItemSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  hotelDepartmentId: z.string().uuid().optional(),
  statusLightCode: z.string().trim().min(1).optional(),
})

export class CreateCatalogItemDto extends createZodDto(createCatalogItemSchema) {}
export class UpdateCatalogItemDto extends createZodDto(updateCatalogItemSchema) {}
