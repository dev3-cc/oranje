import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { z, ZodType } from 'zod'

interface ZodDtoClass {
  zodSchema: ZodType
}

function isZodDto(metatype: unknown): metatype is ZodDtoClass {
  return typeof metatype === 'function' && 'zodSchema' in metatype
}

// Un argumento que no sea DTO de Zod pasa sin tocarse.
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

// El tipo lo infiere Zod, así que no hay una segunda declaración que se
// pueda desincronizar.
export function createZodDto<T extends ZodType>(schema: T): { new (): z.infer<T>; zodSchema: T } {
  class ZodDto {
    static readonly zodSchema = schema
  }

  return ZodDto as unknown as { new (): z.infer<T>; zodSchema: T }
}
