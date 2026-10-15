import { UnauthorizedException } from '@nestjs/common'

import { SchedulerTokenService } from '../../src/common/security/scheduler-token.service.js'

import { close } from './db.js'

/**
 * El barrido que corre solo lo llama un programador de tareas, no una
 * persona: lo autentica el token OIDC de Google.
 *
 * Lo que se prueba aquí es la puerta, no el token: que SIN configurar y SIN
 * token la respuesta sea 401 y no «adelante». Un endpoint que cierra
 * asignaciones no puede quedar abierto a quien conozca la ruta.
 */
afterAll(async () => {
  await close()
})

function servicio(vars: Record<string, string | undefined>): SchedulerTokenService {
  return new SchedulerTokenService({
    get: (k: string) => vars[k],
  } as never)
}

test('sin configurar, el barrido programado no deja pasar a nadie', async () => {
  const sinConfigurar = servicio({})

  await expect(sinConfigurar.verify('Bearer loquesea')).rejects.toThrow(UnauthorizedException)
})

test('configurado pero sin token, tampoco', async () => {
  const configurado = servicio({ SCHEDULER_AUDIENCE: 'https://api.example.test/x' })

  await expect(configurado.verify(undefined)).rejects.toThrow(UnauthorizedException)
  await expect(configurado.verify('no-es-bearer')).rejects.toThrow(UnauthorizedException)
})

test('un token que no firmó Google se rechaza', async () => {
  const configurado = servicio({ SCHEDULER_AUDIENCE: 'https://api.example.test/x' })

  await expect(configurado.verify('Bearer a.b.c')).rejects.toThrow(UnauthorizedException)
})
