import { ArgumentMetadata, BadRequestException } from '@nestjs/common'
import { z } from 'zod'

import { createZodDto, ZodValidationPipe } from '../src/common/pipes/index.js'

const createProspectSchema = z.object({
  hotelId: z.uuid(),
  needDescription: z.string().min(1).optional(),
})

class CreateProspectDto extends createZodDto(createProspectSchema) {}

function bodyMetadata(metatype: unknown): ArgumentMetadata {
  return { type: 'body', metatype: metatype as ArgumentMetadata['metatype'] }
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe()

  it('deja pasar un body válido y devuelve el valor parseado', () => {
    const body = { hotelId: '019fec78-264c-710f-8f61-8ac23273d345' }

    expect(pipe.transform(body, bodyMetadata(CreateProspectDto))).toEqual(body)
  })

  it('rechaza con 400 un body inválido y dice qué campo falló', () => {
    expect.assertions(3)

    try {
      pipe.transform({ hotelId: 'no-es-un-uuid' }, bodyMetadata(CreateProspectDto))
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)

      const payload = (error as BadRequestException).getResponse() as {
        code: string
        details: { field: string }[]
      }

      expect(payload.code).toBe('VALIDATION_ERROR')
      expect(payload.details[0]?.field).toBe('hotelId')
    }
  })

  it('no toca un argumento que no sea un DTO de Zod — los :id sueltos pasan', () => {
    expect(pipe.transform('abc', { type: 'param', metatype: String, data: 'id' })).toBe('abc')
  })
})
