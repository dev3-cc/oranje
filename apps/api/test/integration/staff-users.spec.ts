import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { GoogleAuth } from 'google-auth-library'

import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { RolesService } from '../../src/modules/identity/roles/roles.service.js'
import type { CreateStaffUserDto } from '../../src/modules/identity/users/dto/create-staff-user.dto.js'
import { createStaffUserSchema } from '../../src/modules/identity/users/dto/create-staff-user.dto.js'
import { queryStaffUsersSchema } from '../../src/modules/identity/users/dto/query-staff-users.dto.js'
import { updateStaffUserSchema } from '../../src/modules/identity/users/dto/update-staff-user.dto.js'
import { FirebaseAccountsService } from '../../src/modules/identity/users/firebase-accounts.service.js'
import { StaffUsersRepository } from '../../src/modules/identity/users/staff-users.repository.js'
import { StaffUsersService } from '../../src/modules/identity/users/staff-users.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El CRUD del personal del sistema con las dos formas de nacer la credencial:
 * invitación (default) y contraseña puesta por el Administrador. Firebase NO
 * se toca: el fetch a Identity Toolkit se mockea, que además es lo que fija el
 * contrato — qué se manda, qué se tolera (EMAIL_EXISTS sin contraseña) y qué
 * se rechaza (EMAIL_EXISTS con contraseña).
 */

const fetchMock = jest.fn<Promise<unknown>, [string | URL | Request, RequestInit?]>()
const realFetch = globalThis.fetch

function respondOk(): Promise<unknown> {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
}

function respondError(code: string, status = 400): Promise<unknown> {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message: code } }),
  })
}

function sentBody(call: number): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call]![1]!.body as string) as Record<string, unknown>
}

function sentUrl(call: number): string {
  return fetchMock.mock.calls[call]![0] as string
}

function dto(overrides: Record<string, unknown>): CreateStaffUserDto {
  return createStaffUserSchema.parse({
    fullName: 'Personal de prueba',
    roleCode: 'ROL-V-01',
    ...overrides,
  })
}

let service: StaffUsersService
let auth: { id: string; roleCode: string; hotelId: null; departmentId: null }
const stamp = Date.now()
const created: string[] = []

// El bucket tampoco se toca: lo que fija el contrato es que la entidad trae la
// URL firmada al leer, y null cuando el firmado falla (D-30).
const storageFake = {
  signedUrl: jest.fn((path: string) => Promise.resolve(`https://firmada.local/${path}`)),
}

async function rowByEmail(
  email: string,
): Promise<{ id: string; firebaseUid: string | null } | null> {
  const row = await db.user.findUnique({
    where: { email },
    select: { id: true, firebaseUid: true },
  })

  if (row) created.push(row.id)

  return row
}

async function journalOf(userId: string): Promise<Array<{ eventType: string; payload: unknown }>> {
  return db.journalEntry.findMany({
    where: { entityType: 'identity.user', entityId: userId },
    select: { eventType: true, payload: true },
    orderBy: { occurredAt: 'asc' },
  })
}

beforeAll(async () => {
  const actorId = (await actor()).id

  auth = { id: actorId, roleCode: 'ROL-SYS-01', hotelId: null, departmentId: null }

  jest.spyOn(GoogleAuth.prototype, 'getAccessToken').mockResolvedValue('token-de-prueba')
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const config = { get: () => 'oranje-test' } as unknown as ConfigService<
    Record<string, unknown>,
    true
  >

  service = new StaffUsersService(
    new StaffUsersRepository(db as unknown as PrismaService),
    new FirebaseAccountsService(config),
    storageFake as unknown as StorageService,
  )
})

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(respondOk)
})

afterAll(async () => {
  globalThis.fetch = realFetch
  jest.restoreAllMocks()
  await db.journalEntry.deleteMany({
    where: { entityType: 'identity.user', entityId: { in: created } },
  })
  await db.user.deleteMany({ where: { id: { in: created } } })
  await close()
})

describe('alta por invitación (sin contraseña)', () => {
  it('crea la fila sin cuenta y dispara la invitación de Firebase', async () => {
    const email = `invitacion-${stamp}@oranje.local`

    const entity = await service.create(dto({ email }), auth)

    expect(entity.hasAccount).toBe(false)
    expect(entity).not.toHaveProperty('password')

    // Primero la cuenta SIN contraseña, luego el correo de restablecimiento.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentUrl(0)).toContain('/projects/oranje-test/accounts')
    expect(sentBody(0)).toEqual({ email })
    expect(sentUrl(1)).toContain('accounts:sendOobCode')
    expect(sentBody(1)).toEqual({ requestType: 'PASSWORD_RESET', email })

    const row = await rowByEmail(email)

    expect(row).not.toBeNull()
    expect(row!.firebaseUid).toBeNull()

    const journal = await journalOf(entity.id)

    expect(journal.map((j) => j.eventType)).toEqual([
      'STAFF_USER_CREATED',
      'STAFF_USER_INVITATION_SENT',
    ])
    expect(journal[0]!.payload).toMatchObject({ credentialOrigin: 'invitation' })
  })

  it('tolera EMAIL_EXISTS: la cuenta manual se enlaza en el primer login', async () => {
    const email = `existente-${stamp}@oranje.local`

    fetchMock.mockImplementationOnce(() => respondError('EMAIL_EXISTS'))

    const entity = await service.create(dto({ email }), auth)

    expect(entity.hasAccount).toBe(false)
    // El correo de restablecimiento salió de todos modos.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentUrl(1)).toContain('accounts:sendOobCode')
    await rowByEmail(email)
  })

  it('si el correo falla, el alta NO se revierte y el journal registra', async () => {
    const email = `fallo-correo-${stamp}@oranje.local`

    fetchMock
      .mockImplementationOnce(respondOk)
      .mockImplementationOnce(() => respondError('INTERNAL_ERROR', 500))

    const entity = await service.create(dto({ email }), auth)

    expect(await rowByEmail(email)).not.toBeNull()

    const journal = await journalOf(entity.id)

    expect(journal.map((j) => j.eventType)).toEqual([
      'STAFF_USER_CREATED',
      'STAFF_USER_INVITATION_FAILED',
    ])
  })
})

describe('alta con contraseña puesta por el Administrador', () => {
  const password = 'Secreta-Que-No-Debe-Constar-9'

  it('crea la cuenta con esa contraseña y manda el correo de bienvenida', async () => {
    const email = `password-${stamp}@oranje.local`

    const entity = await service.create(dto({ email, password }), auth)

    expect(entity).not.toHaveProperty('password')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentBody(0)).toEqual({ email, password })
    // La bienvenida es el mismo sendOobCode y JAMÁS lleva la contraseña.
    expect(sentBody(1)).toEqual({ requestType: 'PASSWORD_RESET', email })

    const journal = await journalOf(entity.id)

    expect(journal[0]!.payload).toMatchObject({ credentialOrigin: 'password' })
    // La contraseña no consta en NINGÚN lado del journal.
    expect(JSON.stringify(journal)).not.toContain(password)
    await rowByEmail(email)
  })

  it('sendWelcomeEmail:false apaga el correo de bienvenida', async () => {
    const email = `sin-bienvenida-${stamp}@oranje.local`

    await service.create(dto({ email, password, sendWelcomeEmail: false }), auth)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentBody(0)).toEqual({ email, password })
    await rowByEmail(email)
  })

  it('EMAIL_EXISTS con contraseña es 409 y la fila no nace', async () => {
    const email = `password-existente-${stamp}@oranje.local`

    fetchMock.mockImplementationOnce(() => respondError('EMAIL_EXISTS'))

    await expect(service.create(dto({ email, password }), auth)).rejects.toThrow(ConflictException)

    expect(await rowByEmail(email)).toBeNull()
  })

  it('el schema exige mínimo 8 caracteres', () => {
    const parsed = createStaffUserSchema.safeParse({
      email: 'x@y.z',
      fullName: 'X',
      roleCode: 'ROL-V-01',
      password: 'corta',
    })

    expect(parsed.success).toBe(false)
  })
})

describe('lo que el alta rechaza', () => {
  it('correo duplicado en Postgres es 409 sin tocar Firebase', async () => {
    const email = `duplicado-${stamp}@oranje.local`

    await service.create(dto({ email }), auth)
    await rowByEmail(email)
    fetchMock.mockClear()

    await expect(service.create(dto({ email }), auth)).rejects.toThrow(ConflictException)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un rol del hotel es 422: su alta es POST /hotels/:hotelId/users', async () => {
    await expect(
      service.create(dto({ email: `hotelero-${stamp}@oranje.local`, roleCode: 'ROL-H-01' }), auth),
    ).rejects.toThrow(UnprocessableEntityException)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('PATCH', () => {
  it('no acepta correo: el schema es estricto', () => {
    expect(updateStaffUserSchema.safeParse({ email: 'nuevo@oranje.local' }).success).toBe(false)
    expect(
      updateStaffUserSchema.safeParse({ email: 'nuevo@oranje.local', fullName: 'Alguien' }).success,
    ).toBe(false)
  })

  it('actualiza nombre y el correo queda intacto', async () => {
    const email = `editable-${stamp}@oranje.local`
    const { id } = await service.create(dto({ email }), auth)

    created.push(id)

    const entity = await service.update(
      id,
      updateStaffUserSchema.parse({ fullName: 'Nombre Nuevo' }),
      auth,
    )

    expect(entity.fullName).toBe('Nombre Nuevo')
    expect(entity.email).toBe(email)
  })
})

describe('el reenvío de la invitación', () => {
  it('reenvía mientras firebase_uid siga nulo', async () => {
    const email = `reenvio-${stamp}@oranje.local`
    const { id } = await service.create(dto({ email }), auth)

    created.push(id)
    fetchMock.mockClear()

    await service.resendInvitation(id, auth)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sentUrl(1)).toContain('accounts:sendOobCode')

    const journal = await journalOf(id)

    expect(journal.at(-1)!.payload).toMatchObject({ kind: 'resend' })
  })

  it('con la cuenta ya enlazada es 409', async () => {
    const email = `enlazado-${stamp}@oranje.local`
    const { id } = await service.create(dto({ email }), auth)

    created.push(id)
    await db.user.update({ where: { id }, data: { firebaseUid: `uid-${stamp}` } })

    await expect(service.resendInvitation(id, auth)).rejects.toThrow(ConflictException)
  })
})

describe('la foto (D-30)', () => {
  const path = `users/photo/foto-${stamp}.webp`

  it('el alta acepta photoPath del prefijo users/photo/ y regresa la URL firmada', async () => {
    const email = `con-foto-${stamp}@oranje.local`

    const entity = await service.create(dto({ email, photoPath: path }), auth)

    expect(entity.photoUrl).toBe(`https://firmada.local/${path}`)
    await rowByEmail(email)
  })

  it('un prefijo ajeno es 400: no se apunta a un documento de otra carpeta', () => {
    const ajenos = [
      'workers/photo/foto.webp',
      'workers/document/fiscal.pdf',
      'users/photo/../fuga.webp',
    ]

    for (const malo of ajenos) {
      expect(
        createStaffUserSchema.safeParse({
          email: 'x@y.z',
          fullName: 'X',
          roleCode: 'ROL-V-01',
          photoPath: malo,
        }).success,
      ).toBe(false)
      expect(updateStaffUserSchema.safeParse({ photoPath: malo }).success).toBe(false)
    }
  })

  it('el listado firma la foto y PATCH photoPath:null la quita', async () => {
    const email = `quita-foto-${stamp}@oranje.local`
    const { id } = await service.create(dto({ email, photoPath: path }), auth)

    created.push(id)

    const listado = await service.list(queryStaffUsersSchema.parse({ search: email }))

    expect(listado.data[0]!.photoUrl).toBe(`https://firmada.local/${path}`)

    const sinFoto = await service.update(id, updateStaffUserSchema.parse({ photoPath: null }), auth)

    expect(sinFoto.photoUrl).toBeNull()
  })

  it('si el firmado falla, photoUrl va null sin tumbar la lectura', async () => {
    const email = `firma-caida-${stamp}@oranje.local`
    const { id } = await service.create(dto({ email, photoPath: path }), auth)

    created.push(id)
    storageFake.signedUrl.mockResolvedValueOnce(null as never)

    const entity = await service.get(id)

    expect(entity.photoUrl).toBeNull()
  })
})

describe('el catálogo de roles internos', () => {
  it('excluye los roles del hotel y al Colaborador', async () => {
    const roles = await new RolesService(db as unknown as PrismaService).internal()
    const codes = roles.map((r) => r.code)

    expect(codes).toContain('ROL-ADM-01')
    expect(codes).toContain('ROL-V-01')
    expect(codes).not.toContain('ROL-C-01')
    expect(codes.some((c) => c.startsWith('ROL-H-'))).toBe(false)
  })
})

describe('users:manage', () => {
  it('queda sembrado para ROL-ADM-01', async () => {
    const admin = await db.role.findUniqueOrThrow({ where: { code: 'ROL-ADM-01' } })
    const row = await db.rolePermission.findFirst({
      where: { roleId: admin.id, module: 'users', action: 'manage' },
    })

    expect(row).not.toBeNull()
  })
})

describe('la respuesta dice si el correo salió', () => {
  it('el correo sale: invitationSent true y sin error', async () => {
    const entity = await service.create(dto({ email: `sale-${Date.now()}@oranje.local` }), auth)

    created.push(entity.id)

    expect(entity.invitationSent).toBe(true)
    expect(entity).not.toHaveProperty('invitationError')
  })

  // Lo que pasó de verdad el 26-ago: el usuario se creó y la pantalla dijo
  // «Usuario creado» sobre un correo que nunca salió.
  it('el correo falla: el usuario SÍ se crea, pero la respuesta lo cuenta', async () => {
    const email = `falla-${Date.now()}@oranje.local`

    fetchMock.mockImplementation(() =>
      respondError('Your application is authenticating by using local ADC', 403),
    )

    const entity = await service.create(dto({ email }), auth)

    expect(entity.id).toBeTruthy()
    expect(entity.invitationSent).toBe(false)
    expect(entity.invitationError).toBe('FIREBASE_UNAVAILABLE')

    expect(await db.user.findUnique({ where: { id: entity.id } })).not.toBeNull()

    created.push(entity.id)
  })

  it('un correo que Identity Toolkit rechaza se distingue de Firebase caído', async () => {
    fetchMock.mockImplementation(() => respondError('INVALID_EMAIL'))

    const entity = await service.create(dto({ email: `malo-${Date.now()}@oranje.local` }), auth)

    expect(entity.invitationError).toBe('EMAIL_REJECTED')

    created.push(entity.id)
  })

  it('sin correo pedido, invitationSent es false y no hay error', async () => {
    const entity = await service.create(
      dto({
        email: `sin-correo-${Date.now()}@oranje.local`,
        password: 'Prueba12345!',
        sendWelcomeEmail: false,
      }),
      auth,
    )

    expect(entity.invitationSent).toBe(false)
    expect(entity).not.toHaveProperty('invitationError')

    created.push(entity.id)
  })

  it('el journal guarda el error COMPLETO, no la primera palabra', async () => {
    const email = `detalle-${Date.now()}@oranje.local`
    const mensaje = 'Your application is authenticating by using local ADC'

    fetchMock.mockImplementation(() => respondError(mensaje, 403))

    const entity = await service.create(dto({ email }), auth)

    const entry = await db.journalEntry.findFirst({
      where: { entityId: entity.id, eventType: 'STAFF_USER_INVITATION_FAILED' },
    })

    expect(entry?.payload).toMatchObject({ error: 'Your', detail: mensaje })

    created.push(entity.id)
  })
})
