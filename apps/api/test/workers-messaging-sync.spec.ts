import { HttpException, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../src/config/env.validation.js'
import { MessagingPlatformService } from '../src/infra/messaging/index.js'
import {
  WorkersMessagingSyncService,
  toCsv,
} from '../src/modules/personal/workers/workers-messaging-sync.service.js'
import type {
  WorkerRow,
  WorkersRepository,
} from '../src/modules/personal/workers/workers.repository.js'

/* El repositorio importa `uuid`, que solo viene como ESM; aquí no se usa. */
jest.mock('uuid', () => ({ v7: () => '00000000-0000-7000-8000-000000000000' }))

const CONFIGURED: Partial<Env> = {
  MESSAGING_API_URL: 'https://mensajeria.example.com',
  MESSAGING_API_EMAIL: 'oranje@example.com',
  MESSAGING_API_PASSWORD: 'secreto',
}

const BASE = 'https://mensajeria.example.com/api'

/** Números de EE. UU. válidos y distintos: (404) 555-01xx no lo es para libphonenumber. */
function phone(i: number): string {
  return `+1720366${String(7000 + i)}`
}

function worker(overrides: Partial<WorkerRow>): WorkerRow {
  return {
    id: 'w1',
    fullName: 'Ana María Ruiz',
    phone: phone(0),
    isBlacklisted: false,
    state: { code: 'VERDE', color: 'verde', name: 'Disponible' },
    assignment: null,
    ...overrides,
  } as WorkerRow
}

function makeService(rows: WorkerRow[], values: Partial<Env> = CONFIGURED) {
  const config = { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>
  const findMany = jest.fn((filter: { page: number; limit: number }) =>
    Promise.resolve({
      rows: rows.slice((filter.page - 1) * filter.limit, filter.page * filter.limit),
      total: rows.length,
    }),
  )
  const repo = { findMany } as unknown as WorkersRepository
  return {
    service: new WorkersMessagingSyncService(repo, new MessagingPlatformService(config)),
    findMany,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface Call {
  method: string
  url: string
  body?: unknown
}

/** La plataforma simulada: etiqueta Oranje y los contactos que se le pasen. */
interface FakeContact {
  id: string
  phoneE164: string
  isActive: boolean
  tags?: string[]
}

function platform(contacts: FakeContact[], importStatus = 201, existingTags = ['Oranje']): Call[] {
  const calls: Call[] = []
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url.endsWith('/api/auth/login')) return json({ token: 't' })
    if (url.endsWith('/api/contacts/import')) {
      const file = (init?.body as FormData).get('file') as Blob
      calls.push({ method, url, body: (await file.text()).split('\n').length })
      return importStatus === 201
        ? json({ tags: ['Oranje'], total: 3, created: 2, updated: 1, skipped: 0 }, 201)
        : json({ error: { message: 'El archivo no tiene hojas' } }, importStatus)
    }
    if (url.endsWith('/api/tags') && method === 'GET') {
      return json({
        tags: existingTags.map((name) => ({ id: tagId(name), name, color: null, contactCount: 0 })),
      })
    }
    if (url.endsWith('/api/tags') && method === 'POST') {
      calls.push({ method, url, body: JSON.parse(String(init?.body as string)) })
      return json({ tag: { id: tagId('Oranje: lista negra') } }, 201)
    }
    if (url.includes('/api/contacts?')) {
      return json({
        data: contacts.map((contact) => ({
          ...contact,
          tags: (contact.tags ?? ['Oranje']).map((name) => ({ tag: { id: tagId(name) } })),
        })),
        pagination: { page: 1, limit: 100, total: contacts.length, totalPages: 1 },
      })
    }
    calls.push({
      method,
      url,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    return json({ contact: {} })
  }) as unknown as typeof fetch
  return calls
}

function tagId(name: string): string {
  if (name === 'Oranje') return 'tag-oranje'
  if (name === 'Oranje: lista negra') return 'tag-lista-negra'
  return `tag-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`
}

describe('Sincronizar colaboradores con Mensajería', () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
  })

  it('arma el CSV con nombre, apellido, teléfono E.164 y etiquetas de estado y hotel', () => {
    const csv = toCsv([
      {
        worker: worker({
          assignment: {
            requisitionId: 'r1',
            requisitionNumber: 'REQ-1',
            hotelId: 'h1',
            hotelName: 'Riu, Cancún',
          },
        }),
        e164: phone(0),
      },
    ])

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.slice(1).split('\n')).toEqual([
      'Nombre,Apellido,Telefono,Etiquetas,oranjeId',
      `Ana,María Ruiz,${phone(0)},Estado: Disponible;Hotel: Riu Cancún,w1`,
    ])
  })

  it('manda a todos con teléfono válido, también la lista negra, y corrige quién está activo', async () => {
    const rows = [
      worker({ id: 'activo', phone: phone(1) }),
      worker({ id: 'entra-a-lista-negra', phone: phone(2), isBlacklisted: true }),
      worker({ id: 'sale-de-lista-negra', phone: '(720) 366-7003' }),
      worker({ id: 'desactivado-a-mano', phone: phone(4) }),
      worker({ id: 'sin-tel', phone: '' }),
      worker({ id: 'tel-invalido', phone: '123' }),
    ]
    const { service } = makeService(rows)
    const calls = platform(
      [
        { id: 'c1', phoneE164: phone(1).slice(1), isActive: true },
        { id: 'c2', phoneE164: phone(2).slice(1), isActive: true },
        {
          id: 'c3',
          phoneE164: phone(3).slice(1),
          isActive: false,
          tags: ['Oranje', 'Oranje: lista negra'],
        },
        { id: 'c4', phoneE164: phone(4).slice(1), isActive: false },
        { id: 'otro', phoneE164: '5215512345678', isActive: false },
      ],
      201,
      ['Oranje', 'Oranje: lista negra'],
    )

    await expect(service.sync()).resolves.toEqual({
      sent: 4,
      created: 2,
      updated: 1,
      rejected: 0,
      withoutPhone: 1,
      invalidPhone: 1,
      deactivated: 1,
      reactivated: 1,
      retagged: 0,
    })
    // c4 lo desactivó alguien a mano en la plataforma: no lleva la marca y no se toca.
    expect(calls).toEqual([
      { method: 'POST', url: `${BASE}/contacts/import`, body: 5 },
      {
        method: 'PATCH',
        url: `${BASE}/contacts/c2`,
        body: { isActive: false, tagIds: ['tag-oranje', 'tag-lista-negra'] },
      },
      {
        method: 'PATCH',
        url: `${BASE}/contacts/c3`,
        body: { isActive: true, tagIds: ['tag-oranje'] },
      },
    ])
  })

  it('deja solo el hotel y el estado de hoy, sin tocar las demás etiquetas', async () => {
    const { service } = makeService([
      worker({ phone: phone(1), state: { code: 'VERDE', color: 'verde', name: 'Disponible' } }),
      worker({ id: 'w2', phone: phone(2) }),
    ])
    const calls = platform(
      [
        {
          id: 'c1',
          phoneE164: phone(1).slice(1),
          isActive: true,
          tags: ['Oranje', 'Estado: Blacklist', 'Hotel: Riu', 'Estado: Disponible', 'VIP'],
        },
        // Ya está al día: no se le escribe.
        {
          id: 'c2',
          phoneE164: phone(2).slice(1),
          isActive: true,
          tags: ['Oranje', 'Estado: Disponible'],
        },
      ],
      201,
      ['Oranje', 'Estado: Blacklist', 'Estado: Disponible', 'Hotel: Riu', 'VIP'],
    )

    await expect(service.sync()).resolves.toMatchObject({ retagged: 1 })
    expect(calls.slice(1)).toEqual([
      {
        method: 'PATCH',
        url: `${BASE}/contacts/c1`,
        body: { isActive: true, tagIds: ['tag-oranje', 'tag-vip', 'tag-estado-disponible'] },
      },
    ])
  })

  it('crea la marca de lista negra la primera vez que hace falta', async () => {
    const { service } = makeService([worker({ phone: phone(2), isBlacklisted: true })])
    const calls = platform([{ id: 'c2', phoneE164: phone(2).slice(1), isActive: true }])

    await expect(service.sync()).resolves.toMatchObject({ deactivated: 1, reactivated: 0 })
    expect(calls.slice(1)).toEqual([
      { method: 'POST', url: `${BASE}/tags`, body: { name: 'Oranje: lista negra' } },
      {
        method: 'PATCH',
        url: `${BASE}/contacts/c2`,
        body: { isActive: false, tagIds: ['tag-oranje', 'tag-lista-negra'] },
      },
    ])
  })

  it('el estado cuenta cuántos colaboradores faltan, por teléfono', async () => {
    const rows = [
      worker({ id: 'a', phone: phone(1) }),
      worker({ id: 'b', phone: phone(2), isBlacklisted: true }),
      worker({ id: 'nuevo', phone: phone(3) }),
      worker({ id: 'mismo-tel', phone: phone(3) }),
      worker({ id: 'tel-invalido', phone: '123' }),
    ]
    const { service } = makeService(rows)
    platform([
      { id: 'c1', phoneE164: phone(1).slice(1), isActive: true },
      { id: 'c2', phoneE164: phone(2).slice(1), isActive: false },
      { id: 'ya-no-esta', phoneE164: phone(9).slice(1), isActive: true },
    ])

    await expect(service.status()).resolves.toEqual({
      configured: true,
      workers: 3,
      synced: 2,
      pending: 1,
      excluded: [
        { id: 'tel-invalido', fullName: 'Ana María Ruiz', phone: '123', reason: 'INVALID_PHONE' },
      ],
    })
  })

  it('un 400 de la plataforma llega con su mensaje', async () => {
    const { service } = makeService([worker({})])
    platform([], 400)

    const attempt = service.sync()
    await expect(attempt).rejects.toBeInstanceOf(HttpException)
    await expect(attempt).rejects.toMatchObject({ status: 400 })
  })

  it('sin plataforma: sincronizar responde 503 y el estado dice no configurado', async () => {
    const { service, findMany } = makeService([worker({})], {})
    await expect(service.sync()).rejects.toBeInstanceOf(ServiceUnavailableException)
    await expect(service.status()).resolves.toEqual({ configured: false })
    expect(findMany).not.toHaveBeenCalled()
  })
})
