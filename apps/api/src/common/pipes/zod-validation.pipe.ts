import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { z, ZodType } from 'zod'

/**
 * DTO que lleva su propio schema de Zod. Lo produce `createZodDto`.
 */
interface ZodDtoClass {
  zodSchema: ZodType
}

function isZodDto(metatype: unknown): metatype is ZodDtoClass {
  return typeof metatype === 'function' && 'zodSchema' in metatype
}

/**
 * El pipe global de validación — Estándares de Desarrollo §6: *Zod en el pipe
 * global, ningún body llega a un controller sin validar*.
 *
 * No es el `ValidationPipe` de Nest: ese exige `class-validator`, y decorar las
 * clases con él significaría escribir cada regla dos veces, porque el web y el
 * móvil ya validan sus formularios con el schema de Zod. El schema es uno solo
 * y vive en `packages/contracts`.
 *
 * Un argumento cuyo tipo no sea un DTO de Zod pasa sin tocarse: así los `:id` y
 * los query params sueltos no obligan a declarar un schema por parámetro.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const { metatype } = metadata

    if (!isZodDto(metatype)) {
      return value
    }

    const result = metatype.zodSchema.safeParse(value)

    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    return result.data
  }
}

/**
 * Convierte un schema de Zod en una clase que Nest puede usar como tipo de un
 * `@Body()`. El tipo del parámetro sigue siendo el que infiere Zod, así que no
 * hay una segunda declaración que se pueda desincronizar.
 *
 * ```ts
 * // packages/contracts
 * export const createProspectSchema = z.object({ hotelId: z.uuid() })
 *
 * // apps/api
 * export class CreateProspectDto extends createZodDto(createProspectSchema) {}
 *
 * @Post()
 * create(@Body() dto: CreateProspectDto) { … }   // dto ya viene validado
 * ```
 */
export function createZodDto<T extends ZodType>(schema: T): { new (): z.infer<T>; zodSchema: T } {
  class ZodDto {
    static readonly zodSchema = schema
  }

  return ZodDto as unknown as { new (): z.infer<T>; zodSchema: T }
}
