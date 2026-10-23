import { BadGatewayException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../src/config/env.validation.js'
import { MessagingPlatformService } from '../src/infra/messaging/index.js'
import { MessagingService } from '../src/modules/notifications/messaging/messaging.service.js'

const CONFIGURED: Partial<Env> = {
  MESSAGING_API_URL: 'https://mensajeria.example.com/',
  MESSAGING_API_EMAIL: 'oranje@example.com',
  MESSAGING_API_PASSWORD: 'secreto',
}

function makeService(values: Partial<Env> = CONFIGURED): MessagingService {
  const config = {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>

  return new MessagingService(new MessagingPlatformService(config))
}

const CAMPAIGN = {
  id: 'c1',
  name: 'Prueba oficina',
  status: 'COMPLETED',
  sentCount: 3,
  totalRecipients: 3,
  createdAt: '2026-09-11T15:29:00.000Z',
  template: { name: 'hello_world' },
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Una plataforma falsa: responde por ruta y cuenta los logins. */
function fakePlatform(options: { expireFirstToken?: boolean } = {}): {
  fetch: jest.Mock
  logins: () => number
} {
  let logins = 0

  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    const path = new URL(url).pathname + new URL(url).search

    if (path === '/api/auth/login') {
      logins += 1
      return Promise.resolve(json({ token: `token-${String(logins)}` }))
    }

    const auth = new Headers(init?.headers).get('Authorization')
    if (options.expireFirstToken === true && auth === 'Bearer token-1') {
      return Promise.resolve(json({ message: 'Token inválido o expirado' }, 401))
    }

    if (path.startsWith('/api/contacts')) {
      return Promise.resolve(
        json({ data: [], pagination: { page: 1, limit: 1, total: 4, totalPages: 4 } }),
      )
    }
    if (path === '/api/templates') {
      return Promise.resolve(json({ templates: [{ id: 'p1' }, { id: 'p2' }] }))
    }
    if (path.startsWith('/api/campaigns')) {
      return Promise.resolve(
        json({ data: [CAMPAIGN], pagination: { page: 1, limit: 5, total: 1, totalPages: 1 } }),
      )
    }
    return Promise.resolve(json({ message: 'no encontrado' }, 404))
  })

  return { fetch: fetchMock, logins: () => logins }
}

describe('MessagingService.overview', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
  })

  it('sin las variables MESSAGING_API_* dice que no está configurado, sin llamar a nadie', async () => {
    const platform = fakePlatform()
    global.fetch = platform.fetch

    await expect(makeService({}).overview()).resolves.toEqual({ configured: false })
    expect(platform.fetch).not.toHaveBeenCalled()
  })

  it('arma el Panel con contactos, plantillas y campañas recientes, con un solo login', async () => {
    const platform = fakePlatform()
    global.fetch = platform.fetch

    await expect(makeService().overview()).resolves.toEqual({
      configured: true,
      contacts: 4,
      templates: 2,
      campaigns: 1,
      recentCampaigns: [
        {
          id: 'c1',
          name: 'Prueba oficina',
          templateName: 'hello_world',
          status: 'COMPLETED',
          sentCount: 3,
          totalRecipients: 3,
          createdAt: '2026-09-11T15:29:00.000Z',
        },
      ],
    })
    expect(platform.fetch).toHaveBeenCalledWith(
      'https://mensajeria.example.com/api/campaigns?page=1&limit=5',
      expect.anything(),
    )
  })

  it('si el token caduca, vuelve a entrar una vez y sigue', async () => {
    const platform = fakePlatform({ expireFirstToken: true })
    global.fetch = platform.fetch
    const service = makeService()

    await service.overview()
    await expect(service.overview()).resolves.toMatchObject({ configured: true, contacts: 4 })
  })

  it('si la plataforma rechaza la cuenta de servicio, responde 502', async () => {
    global.fetch = jest.fn(() => Promise.resolve(json({ message: 'Credenciales' }, 401)))

    await expect(makeService().overview()).rejects.toBeInstanceOf(BadGatewayException)
  })
})
