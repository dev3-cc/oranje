import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../src/config/env.validation.js'
import { AccessTokenService } from '../src/modules/identity/auth/access-token.service.js'

const LOCAL: Partial<Env> = {
  APP_ENV: 'local',
  JWT_SECRET: 'un-secreto-de-mas-de-treinta-y-dos-caracteres',
  JWT_ACCESS_TTL_S: 900,
}

function makeService(values: Partial<Env> = LOCAL): AccessTokenService {
  const config = {
    get: (key: keyof Env) => values[key],
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
    const service = makeService()
    const { token, expiresIn } = await service.sign(payload)

    expect(expiresIn).toBe(900)
    await expect(service.verify(token)).resolves.toEqual(payload)
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const { token } = await makeService().sign(payload)

    const other = makeService({ ...LOCAL, JWT_SECRET: 'otro-secreto-igual-de-largo-para-hs256' })

    await expect(other.verify(token)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rechaza basura', async () => {
    await expect(makeService().verify('no.es.un.token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('en un ambiente desplegado exige el par de llaves, no el secreto', async () => {
    const withoutKeys = makeService({ APP_ENV: 'staging', JWT_ACCESS_TTL_S: 900 })

    await expect(withoutKeys.sign(payload)).rejects.toThrow(/JWT_PRIVATE_KEY/)
  })
})
