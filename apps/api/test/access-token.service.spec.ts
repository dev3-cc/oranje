import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../src/config/env.validation.js'
import { AccessTokenService } from '../src/modules/identity/auth/access-token.service.js'

const VALORES: Partial<Env> = {
  JWT_SECRET: 'un-secreto-de-mas-de-treinta-y-dos-caracteres',
  JWT_ACCESS_TTL_S: 900,
}

function servicio(): AccessTokenService {
  const config = {
    get: (clave: keyof Env) => VALORES[clave],
  } as unknown as ConfigService<Env, true>

  return new AccessTokenService(config)
}

describe('AccessTokenService', () => {
  const payload = {
    sub: '019ffb54-557b-777e-ac3f-0f3b6909ec07',
    roleCode: 'ROL-V-01',
    hotelId: null,
    departmentId: null,
  }

  it('firma y vuelve a leer el alcance del usuario', async () => {
    const service = servicio()
    const { token, expiresIn } = await service.sign(payload)

    expect(expiresIn).toBe(900)
    await expect(service.verify(token)).resolves.toEqual(payload)
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const { token } = await servicio().sign(payload)

    const otro = new AccessTokenService({
      get: (clave: keyof Env) =>
        clave === 'JWT_SECRET' ? 'otro-secreto-igual-de-largo-para-hs256' : 900,
    } as unknown as ConfigService<Env, true>)

    await expect(otro.verify(token)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rechaza basura', async () => {
    await expect(servicio().verify('no.es.un.token')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
