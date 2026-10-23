import { HttpException, ServiceUnavailableException } from '@nestjs/common'
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const TEMPLATE = {
  id: 'tpl1',
  metaTemplateId: '123',
  name: 'turno_confirmado',
  category: 'UTILITY',
  language: 'es_MX',
  status: 'APPROVED',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'Oranje' },
    { type: 'BODY', text: 'Hola {{1}}, tu turno en {{2}} quedó confirmado.' },
    { type: 'FOOTER', text: 'No respondas a este mensaje' },
  ],
  variableCount: 2,
  rejectionReason: null,
  syncedAt: '2026-10-20T10:00:00.000Z',
}

/** Responde por ruta; el login siempre entra. */
function platform(respond: (method: string, url: string) => Response): void {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/login')) return Promise.resolve(json({ token: 't' }))
    return Promise.resolve(respond(init?.method ?? 'GET', url))
  }) as unknown as typeof fetch
}

describe('Plantillas de Mensajería', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
  })

  it('lista las plantillas con el texto de su BODY', async () => {
    platform(() => json({ templates: [TEMPLATE, { ...TEMPLATE, id: 'tpl2', components: {} }] }))

    const result = await makeService().templates()

    expect(result).toEqual({
      configured: true,
      templates: [
        {
          id: 'tpl1',
          name: 'turno_confirmado',
          category: 'UTILITY',
          language: 'es_MX',
          status: 'APPROVED',
          variableCount: 2,
          body: 'Hola {{1}}, tu turno en {{2}} quedó confirmado.',
          rejectionReason: null,
          syncedAt: '2026-10-20T10:00:00.000Z',
        },
        expect.objectContaining({ id: 'tpl2', body: null }),
      ],
    })
  })

  it('sincroniza con un POST y devuelve lo que trajo', async () => {
    const calls: string[] = []
    platform((method, url) => {
      calls.push(`${method} ${url}`)
      return json({ synced: 3, created: 1, updated: 2 })
    })

    await expect(makeService().syncTemplates()).resolves.toEqual({
      synced: 3,
      created: 1,
      updated: 2,
    })
    expect(calls).toEqual(['POST https://mensajeria.example.com/api/templates/sync'])
  })

  it('sin credenciales de Meta, el 400 de la plataforma llega con su mensaje', async () => {
    platform(() =>
      json(
        {
          error: {
            code: 'BAD_REQUEST',
            message:
              'Configurá el access token y el WhatsApp Business Account ID en el panel antes de sincronizar',
          },
        },
        400,
      ),
    )

    const attempt = makeService().syncTemplates()

    await expect(attempt).rejects.toBeInstanceOf(HttpException)
    await expect(attempt).rejects.toMatchObject({ status: 400 })
  })

  it('sin plataforma: listar dice no configurado y sincronizar responde 503', async () => {
    await expect(makeService({}).templates()).resolves.toEqual({ configured: false })
    await expect(makeService({}).syncTemplates()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })
})
