import { BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../src/config/env.validation.js'
import { MessagingPlatformService } from '../src/infra/messaging/index.js'
import { MessagingController } from '../src/modules/notifications/messaging/messaging.controller.js'
import { MessagingService } from '../src/modules/notifications/messaging/messaging.service.js'

const CONFIGURED: Partial<Env> = {
  MESSAGING_API_URL: 'https://mensajeria.example.com',
  MESSAGING_API_EMAIL: 'oranje@example.com',
  MESSAGING_API_PASSWORD: 'secreto',
}

function makeController(values: Partial<Env> = CONFIGURED): MessagingController {
  const config = {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>

  return new MessagingController(new MessagingService(new MessagingPlatformService(config)))
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const PLATFORM_CONTACT = {
  id: 'ct1',
  firstName: 'Ana',
  lastName: null,
  phoneE164: '5215512345678',
  email: null,
  optedOut: false,
  tags: [],
}

interface Call {
  method: string
  url: string
  body: unknown
}

/** Responde por ruta y registra lo que se le pidió. */
function platform(respond: (call: Call) => Response): Call[] {
  const calls: Call[] = []
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const call = {
      method: init?.method ?? 'GET',
      url,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }
    if (url.endsWith('/api/auth/login')) return Promise.resolve(json({ token: 't' }))
    calls.push(call)
    return Promise.resolve(respond(call))
  }) as unknown as typeof fetch
  return calls
}

describe('Acciones de Contactos de Mensajería', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
  })

  it('crea el contacto con lo que mandó la persona', async () => {
    const calls = platform(() => json({ contact: PLATFORM_CONTACT }, 201))

    const result = await makeController().createContact({
      firstName: 'Ana',
      phone: '55 1234 5678',
      countryCode: 'MX',
    })

    expect(calls).toEqual([
      {
        method: 'POST',
        url: 'https://mensajeria.example.com/api/contacts',
        body: { firstName: 'Ana', phone: '55 1234 5678', countryCode: 'MX' },
      },
    ])
    expect(result.data).toMatchObject({ id: 'ct1', phone: '5215512345678', tags: [] })
  })

  it('un 409 de la plataforma llega como 409 con su mensaje', async () => {
    platform(() =>
      json({ error: { code: 'CONFLICT', message: 'Ya existe un contacto con ese teléfono' } }, 409),
    )

    const attempt = makeController().createContact({ firstName: 'Ana', phone: '5512345678' })

    await expect(attempt).rejects.toBeInstanceOf(HttpException)
    await expect(attempt).rejects.toMatchObject({
      status: 409,
      response: { message: 'Ya existe un contacto con ese teléfono' },
    })
  })

  it('edita, da de baja y elimina en la ruta del contacto', async () => {
    const calls = platform((call) =>
      call.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json({ contact: PLATFORM_CONTACT }),
    )
    const controller = makeController()

    await controller.updateContact('ct1', { email: null, tagIds: ['t1'] })
    await controller.optOutContact('ct1')
    await controller.deleteContact('ct1')

    expect(calls.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'PATCH https://mensajeria.example.com/api/contacts/ct1',
      'POST https://mensajeria.example.com/api/contacts/ct1/opt-out',
      'DELETE https://mensajeria.example.com/api/contacts/ct1',
    ])
    expect(calls[0]?.body).toEqual({ email: null, tagIds: ['t1'] })
  })

  it('un id que no es cuid no llega a la plataforma', async () => {
    const calls = platform(() => json({}))

    await expect(makeController().deleteContact('../users')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(calls).toEqual([])
  })

  it('sin plataforma configurada, escribir responde 503', async () => {
    await expect(makeController({}).optOutContact('ct1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })
})
