import { HttpException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../src/config/env.validation.js'
import { MessagingPlatformService } from '../src/infra/messaging/index.js'
import { createMessagingCampaignSchema } from '../src/modules/notifications/messaging/messaging.dto.js'
import { MessagingService } from '../src/modules/notifications/messaging/messaging.service.js'

const CONFIGURED: Partial<Env> = {
  MESSAGING_API_URL: 'https://mensajeria.example.com',
  MESSAGING_API_EMAIL: 'oranje@example.com',
  MESSAGING_API_PASSWORD: 'secreto',
}

function makeService(values: Partial<Env> = CONFIGURED): MessagingService {
  const config = { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>
  return new MessagingService(new MessagingPlatformService(config))
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const INPUT = {
  name: 'Turnos de noviembre',
  templateId: 'tpl1',
  variableMapping: [
    { kind: 'contact' as const, field: 'firstName' },
    { kind: 'static' as const, value: 'Hotel Riu' },
  ],
  recipientFilter: {
    mode: 'tags' as const,
    tagIds: ['tag-oranje', 'tag-riu'],
    matchAll: true as const,
  },
}

describe('Crear campaña en Mensajería', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
  })

  it('la crea en la plataforma y devuelve el borrador con su total de destinatarios', async () => {
    const calls: Array<{ method: string; url: string; body: unknown }> = []
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/login')) return Promise.resolve(json({ token: 't' }))
      calls.push({
        method: init?.method ?? 'GET',
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      })
      return Promise.resolve(
        json(
          {
            campaign: {
              id: 'cmp1',
              name: 'Turnos de noviembre',
              description: null,
              status: 'DRAFT',
              totalRecipients: 37,
              sentCount: 0,
              deliveredCount: 0,
              readCount: 0,
              failedCount: 0,
              scheduledAt: null,
              startedAt: null,
              completedAt: null,
              createdAt: '2026-10-23T18:00:00.000Z',
              template: { name: 'turno_confirmado' },
            },
          },
          201,
        ),
      )
    }) as unknown as typeof fetch

    await expect(makeService().createCampaign(INPUT)).resolves.toMatchObject({
      id: 'cmp1',
      status: 'DRAFT',
      templateName: 'turno_confirmado',
      totalRecipients: 37,
    })
    expect(calls).toEqual([
      { method: 'POST', url: 'https://mensajeria.example.com/api/campaigns', body: INPUT },
    ])
  })

  it('si las variables no cuadran con la plantilla, el 400 llega con su mensaje', async () => {
    global.fetch = jest.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/api/auth/login')
          ? json({ token: 't' })
          : json(
              { error: { message: 'La plantilla requiere 1 variable(s) pero se enviaron 2' } },
              400,
            ),
      ),
    ) as unknown as typeof fetch

    const attempt = makeService().createCampaign(INPUT)
    await expect(attempt).rejects.toBeInstanceOf(HttpException)
    await expect(attempt).rejects.toMatchObject({ status: 400 })
  })

  it('sin plataforma responde 503', async () => {
    await expect(makeService({}).createCampaign(INPUT)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('el DTO solo acepta campos del contacto conocidos y al menos una etiqueta', () => {
    const base = { name: 'X', templateId: 'tpl1', variableMapping: [], tagIds: ['tagoranje'] }
    expect(createMessagingCampaignSchema.safeParse(base).success).toBe(true)
    expect(
      createMessagingCampaignSchema.safeParse({
        ...base,
        variableMapping: [{ kind: 'contact', field: 'custom:password' }],
      }).success,
    ).toBe(false)
    expect(createMessagingCampaignSchema.safeParse({ ...base, tagIds: [] }).success).toBe(false)
  })
})
