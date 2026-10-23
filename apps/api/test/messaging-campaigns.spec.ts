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

const CAMPAIGN = {
  id: 'cmp1',
  name: 'Turnos de noviembre',
  description: null,
  templateId: 'tpl1',
  status: 'SENDING',
  scheduledAt: null,
  startedAt: '2026-10-22T15:00:00.000Z',
  completedAt: null,
  totalRecipients: 120,
  sentCount: 80,
  deliveredCount: 70,
  readCount: 40,
  failedCount: 3,
  variableMapping: [],
  recipientFilter: { mode: 'all' },
  createdBy: 'u1',
  createdAt: '2026-10-22T14:55:00.000Z',
  updatedAt: '2026-10-22T15:30:00.000Z',
  template: { name: 'turno_confirmado' },
}

/** Responde por ruta; el login siempre entra. */
function platform(respond: (method: string, url: string) => Response): void {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/login')) return Promise.resolve(json({ token: 't' }))
    return Promise.resolve(respond(init?.method ?? 'GET', url))
  }) as unknown as typeof fetch
}

describe('Campañas de Mensajería', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
  })

  it('lista las campañas con sus contadores y pasa el filtro de estado', async () => {
    const calls: string[] = []
    platform((method, url) => {
      calls.push(`${method} ${url}`)
      return json({
        data: [CAMPAIGN],
        pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
      })
    })

    const result = await makeService().campaigns({ page: 2, limit: 20, status: 'SENDING' })

    expect(calls).toEqual([
      'GET https://mensajeria.example.com/api/campaigns?page=2&limit=20&status=SENDING',
    ])
    expect(result).toEqual({
      configured: true,
      campaigns: [
        {
          id: 'cmp1',
          name: 'Turnos de noviembre',
          description: null,
          templateName: 'turno_confirmado',
          status: 'SENDING',
          totalRecipients: 120,
          sentCount: 80,
          deliveredCount: 70,
          readCount: 40,
          failedCount: 3,
          scheduledAt: null,
          startedAt: '2026-10-22T15:00:00.000Z',
          completedAt: null,
          createdAt: '2026-10-22T14:55:00.000Z',
        },
      ],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    })
  })

  it('cada acción es un POST a su ruta en la plataforma', async () => {
    const calls: string[] = []
    platform((method, url) => {
      calls.push(`${method} ${url}`)
      return json({ campaign: CAMPAIGN })
    })

    const service = makeService()
    await service.campaignAction('cmp1', 'send')
    await service.campaignAction('cmp1', 'pause')
    await service.campaignAction('cmp1', 'resume')
    await service.campaignAction('cmp1', 'cancel')

    expect(calls).toEqual([
      'POST https://mensajeria.example.com/api/campaigns/cmp1/send',
      'POST https://mensajeria.example.com/api/campaigns/cmp1/pause',
      'POST https://mensajeria.example.com/api/campaigns/cmp1/resume',
      'POST https://mensajeria.example.com/api/campaigns/cmp1/cancel',
    ])
  })

  it('si el estado no lo permite, el 400 de la plataforma llega con su mensaje', async () => {
    platform(() =>
      json(
        {
          error: { code: 'BAD_REQUEST', message: 'Solo se puede pausar una campaña en envío' },
        },
        400,
      ),
    )

    const attempt = makeService().campaignAction('cmp1', 'pause')

    await expect(attempt).rejects.toBeInstanceOf(HttpException)
    await expect(attempt).rejects.toMatchObject({
      status: 400,
      response: { message: 'Solo se puede pausar una campaña en envío' },
    })
  })

  it('sin plataforma: listar dice no configurado y las acciones responden 503', async () => {
    await expect(makeService({}).campaigns({ page: 1, limit: 20 })).resolves.toEqual({
      configured: false,
    })
    await expect(makeService({}).campaignAction('cmp1', 'send')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })
})
