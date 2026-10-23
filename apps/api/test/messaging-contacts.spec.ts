import { ConfigService } from '@nestjs/config'

import type { Env } from '../src/config/env.validation.js'
import { MessagingPlatformService } from '../src/infra/messaging/index.js'
import { MessagingService } from '../src/modules/notifications/messaging/messaging.service.js'

const CONFIGURED: Partial<Env> = {
  MESSAGING_API_URL: 'https://mensajeria.example.com',
  MESSAGING_API_EMAIL: 'oranje@example.com',
  MESSAGING_API_PASSWORD: 'secreto',
}

function makeService(values: Partial<Env> = CONFIGURED): MessagingService {
  const config = {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>

  return new MessagingService(new MessagingPlatformService(config))
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

const CONTACT = {
  id: 'ct1',
  firstName: 'Ana',
  lastName: 'Ruiz',
  phoneE164: '5215512345678',
  email: 'ana@example.com',
  optedOut: false,
  isActive: true,
  tags: [{ contactId: 'ct1', tagId: 't1', tag: { id: 't1', name: 'Oficina', color: '#3B82F6' } }],
}

describe('MessagingService.contacts', () => {
  const realFetch = global.fetch
  let urls: string[]

  beforeEach(() => {
    urls = []
    global.fetch = jest.fn((url: string) => {
      urls.push(url)
      if (url.endsWith('/api/auth/login')) return Promise.resolve(json({ token: 't' }))
      return Promise.resolve(
        json({ data: [CONTACT], pagination: { page: 2, limit: 20, total: 21, totalPages: 2 } }),
      )
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = realFetch
  })

  it('sin configurar no llama a la plataforma', async () => {
    await expect(makeService({}).contacts({ page: 1, limit: 20 })).resolves.toEqual({
      configured: false,
    })
    expect(urls).toEqual([])
  })

  it('pasa página, límite y búsqueda, y aplana las etiquetas', async () => {
    const result = await makeService().contacts({ page: 2, limit: 20, search: 'ana ruiz' })

    expect(urls).toContain(
      'https://mensajeria.example.com/api/contacts?page=2&limit=20&search=ana+ruiz',
    )
    expect(result).toEqual({
      configured: true,
      contacts: [
        {
          id: 'ct1',
          firstName: 'Ana',
          lastName: 'Ruiz',
          phone: '5215512345678',
          email: 'ana@example.com',
          optedOut: false,
          tags: [{ id: 't1', name: 'Oficina', color: '#3B82F6' }],
        },
      ],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    })
  })

  it('sin búsqueda no manda el parámetro vacío', async () => {
    await makeService().contacts({ page: 1, limit: 20, search: '' })

    expect(urls).toContain('https://mensajeria.example.com/api/contacts?page=1&limit=20')
  })
})
