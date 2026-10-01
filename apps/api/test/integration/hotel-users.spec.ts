import { ConflictException, NotFoundException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { GoogleAuth } from 'google-auth-library'
import { v7 as uuidv7 } from 'uuid'

import { FirebaseAccountsService } from '../../src/infra/firebase/index.js'
import { MailerService } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'
import type { CreateHotelUserDto } from '../../src/modules/identity/users/dto/create-hotel-user.dto.js'
import { createHotelUserSchema } from '../../src/modules/identity/users/dto/create-hotel-user.dto.js'
import { queryHotelUsersSchema } from '../../src/modules/identity/users/dto/query-hotel-users.dto.js'
import { updateHotelUserSchema } from '../../src/modules/identity/users/dto/update-hotel-user.dto.js'
import { HotelUsersRepository } from '../../src/modules/identity/users/hotel-users.repository.js'
import { HotelUsersService } from '../../src/modules/identity/users/hotel-users.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Las cuentas del hotel (Reglas de Negocio · Cuentas del hotel): el primer
 * Manager General nace con la conversión y el resto lo administra el
 * Administrador. Lo que fija esta suite es la jerarquía de «Reporta a» dentro
 * del hotel, el departamento según el rol, el directorio entre hoteles y que
 * la invitación sale (Firebase mockeado, como en staff-users).
 */

/**
 * Los ajustes REALES contra la base de pruebas: el interruptor vive ahí y
 * simularlo escondería justo lo que hay que comprobar.
 */
function ajustes(): SettingsService {
  return new SettingsService(db as unknown as PrismaService)
}

const fetchMock = jest.fn<Promise<unknown>, [string | URL | Request, RequestInit?]>()
const realFetch = globalThis.fetch

function respondOk(): Promise<unknown> {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
}

let service: HotelUsersService
let auth: { id: string; roleCode: string; hotelId: null; departmentId: null }
let hotelA: string
let hotelB: string
let deptCocina: string
let deptLimpieza: string
const stamp = Date.now()
const createdUsers: string[] = []
const createdHotels: string[] = []

function dto(overrides: Record<string, unknown>): CreateHotelUserDto {
  return createHotelUserSchema.parse({
    fullName: 'Cuenta de prueba',
    roleCode: 'ROL-H-03',
    ...overrides,
  })
}

async function hotel(): Promise<string> {
  const id = uuidv7()
  const zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id

  await db.hotel.create({
    data: {
      id,
      name: `Hotel Cuentas ${id.slice(-8)}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: auth.id,
    },
  })
  createdHotels.push(id)

  return id
}

async function create(hotelId: string, overrides: Record<string, unknown>): Promise<string> {
  const entity = await service.create(
    hotelId,
    dto({ email: `cuenta-${uuidv7().slice(-12)}-${stamp}@oranje.local`, ...overrides }),
    auth,
  )
  createdUsers.push(entity.id)

  return entity.id
}

/**
 * El mailer SIN configurar: sin las variables del SMTP se declara apagado y
 * cada correo sale por el respaldo de Firebase, que es lo que estas pruebas
 * ya simulan. Así siguen valiendo tal cual estaban.
 */
function mailerApagado(accounts: FirebaseAccountsService): MailerService {
  const sinCorreo = {
    get: (key: string): string | undefined => (key.startsWith('MAIL_') ? undefined : 'oranje-test'),
  } as unknown as ConfigService<never, true>

  return new MailerService(sinCorreo, db as unknown as PrismaService, accounts, ajustes())
}

beforeAll(async () => {
  const actorId = (await actor()).id

  auth = { id: actorId, roleCode: 'ROL-ADM-01', hotelId: null, departmentId: null }

  jest.spyOn(GoogleAuth.prototype, 'getAccessToken').mockResolvedValue('token-de-prueba')
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const config = { get: () => 'oranje-test' } as unknown as ConfigService<
    Record<string, unknown>,
    true
  >

  service = new HotelUsersService(
    new HotelUsersRepository(db as unknown as PrismaService),
    new FirebaseAccountsService(config),
    mailerApagado(new FirebaseAccountsService(config)),
    /* Permisos REALES contra la base sembrada: quién puede invitar a qué rol
       es justo lo que hay que comprobar, no algo que simular. */
    new PermissionsService(db as unknown as PrismaService),
    /* Sin Pub/Sub en las pruebas: el aviso al BD es mejor esfuerzo y lo que
       importa aquí es el alta, no el correo de cortesía. */
    { publish: (): Promise<void> => Promise.resolve() } as never,
  )

  hotelA = await hotel()
  hotelB = await hotel()

  const departments = await db.hotelDepartment.findMany({ select: { id: true }, take: 2 })
  deptCocina = departments[0]!.id
  deptLimpieza = departments[1]!.id
})

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(respondOk)
})

afterAll(async () => {
  globalThis.fetch = realFetch
  jest.restoreAllMocks()
  await db.journalEntry.deleteMany({
    where: { entityType: 'identity.user', entityId: { in: createdUsers } },
  })
  // Los jefes al final: la FK de reports_to no deja borrar antes a quien tiene subordinados.
  await db.user.updateMany({ where: { id: { in: createdUsers } }, data: { reportsToUserId: null } })
  await db.user.deleteMany({ where: { id: { in: createdUsers } } })
  await db.hotel.deleteMany({ where: { id: { in: createdHotels } } })
  await close()
})

describe('alta de cuentas del hotel', () => {
  it('el Manager General nace sin departamento, con el hotel y con la invitación enviada', async () => {
    const email = `gg-${stamp}@oranje.local`
    const entity = await service.create(hotelA, dto({ email }), auth)
    createdUsers.push(entity.id)

    expect(entity.hotel.id).toBe(hotelA)
    expect(entity.department).toBeNull()
    expect(entity.hasAccount).toBe(false)
    expect(entity.invitationSent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const journal = await db.journalEntry.findMany({
      where: { entityType: 'identity.user', entityId: entity.id },
      select: { eventType: true },
      orderBy: { occurredAt: 'asc' },
    })
    expect(journal.map((e) => e.eventType)).toEqual([
      'HOTEL_USER_CREATED',
      'HOTEL_USER_INVITATION_SENT',
    ])
  })

  it('el Manager General no lleva departamento; Supervisor y Manager de Área SÍ pueden ir sin uno', async () => {
    await expect(
      service.create(
        hotelA,
        dto({ email: `gg2-${stamp}@x.local`, departmentId: deptCocina }),
        auth,
      ),
    ).rejects.toMatchObject({ response: { code: 'DEPARTMENT_NOT_ALLOWED' } })

    // Sin departamento: cubre todo el hotel (jerarquía simple) — ya no rechaza.
    const sinDepto = await service.create(
      hotelA,
      dto({ email: `sup0-${stamp}@x.local`, roleCode: 'ROL-H-01' }),
      auth,
    )
    createdUsers.push(sinDepto.id)
    expect(sinDepto.department).toBeNull()
  })

  it('«Reporta a» respeta la jerarquía del hotel', async () => {
    const gg = await create(hotelA, { roleCode: 'ROL-H-03' })
    const gaCocina = await create(hotelA, {
      roleCode: 'ROL-H-02',
      departmentId: deptCocina,
      reportsToUserId: gg,
    })
    const ggOtroHotel = await create(hotelB, { roleCode: 'ROL-H-03' })

    // Supervisor → Manager de Área de su departamento: sí.
    const sup = await create(hotelA, {
      roleCode: 'ROL-H-01',
      departmentId: deptCocina,
      reportsToUserId: gaCocina,
    })
    expect(sup).toBeTruthy()

    // Supervisor → Manager de Área de OTRO departamento: no.
    await expect(
      create(hotelA, {
        roleCode: 'ROL-H-01',
        departmentId: deptLimpieza,
        reportsToUserId: gaCocina,
      }),
    ).rejects.toMatchObject({ response: { code: 'REPORTS_TO_OTHER_DEPARTMENT' } })

    // Manager de Área → Supervisor: al revés, no.
    await expect(
      create(hotelA, { roleCode: 'ROL-H-02', departmentId: deptCocina, reportsToUserId: sup }),
    ).rejects.toMatchObject({ response: { code: 'REPORTS_TO_NOT_ALLOWED' } })

    // Manager General → nadie.
    await expect(
      create(hotelA, { roleCode: 'ROL-H-03', reportsToUserId: gg }),
    ).rejects.toMatchObject({ response: { code: 'REPORTS_TO_NOT_ALLOWED' } })

    // Jefe de otro hotel: no existe para este hotel.
    await expect(
      create(hotelA, {
        roleCode: 'ROL-H-02',
        departmentId: deptCocina,
        reportsToUserId: ggOtroHotel,
      }),
    ).rejects.toMatchObject({ response: { code: 'SUPERVISOR_NOT_IN_HOTEL' } })
  })

  it('un correo repetido es conflicto y un hotel inexistente no existe', async () => {
    const email = `dup-${stamp}@oranje.local`
    createdUsers.push((await service.create(hotelA, dto({ email }), auth)).id)

    await expect(service.create(hotelB, dto({ email }), auth)).rejects.toBeInstanceOf(
      ConflictException,
    )
    await expect(
      service.create(uuidv7(), dto({ email: `n-${stamp}@x.local` }), auth),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('edición y directorio', () => {
  it('edita nombre, departamento y jefe dentro del hotel, y deja journal', async () => {
    const gg = await create(hotelA, { roleCode: 'ROL-H-03' })
    const sup = await create(hotelA, { roleCode: 'ROL-H-01', departmentId: deptCocina })

    const updated = await service.update(
      hotelA,
      sup,
      updateHotelUserSchema.parse({
        fullName: 'Supervisora Editada',
        departmentId: deptLimpieza,
        reportsToUserId: gg,
      }),
      auth,
    )

    expect(updated.fullName).toBe('Supervisora Editada')
    expect(updated.department?.id).toBe(deptLimpieza)
    expect(updated.reportsToUserId).toBe(gg)

    const journal = await db.journalEntry.findMany({
      where: { entityType: 'identity.user', entityId: sup, eventType: 'HOTEL_USER_UPDATED' },
    })
    expect(journal).toHaveLength(1)

    // Quitar el departamento a un Supervisor: ahora sí — vuelve a cubrir todo el hotel.
    const sinDepto = await service.update(
      hotelA,
      sup,
      updateHotelUserSchema.parse({ departmentId: null }),
      auth,
    )
    expect(sinDepto.department).toBeNull()

    // Desde otro hotel, esa cuenta no existe.
    await expect(
      service.update(hotelB, sup, updateHotelUserSchema.parse({ fullName: 'X' }), auth),
    ).rejects.toMatchObject({ response: { code: 'USER_NOT_FOUND' } })

    // Dar de baja.
    const inactive = await service.update(
      hotelA,
      sup,
      updateHotelUserSchema.parse({ isActive: false }),
      auth,
    )
    expect(inactive.isActive).toBe(false)
  })

  it('el directorio cruza hoteles, filtra por hotel y rol, y esconde inactivos por default', async () => {
    const supA = await create(hotelA, { roleCode: 'ROL-H-01', departmentId: deptCocina })
    const ggB = await create(hotelB, { roleCode: 'ROL-H-03' })
    await service.update(hotelA, supA, updateHotelUserSchema.parse({ isActive: false }), auth)

    const all = await service.directory(queryHotelUsersSchema.parse({ limit: 100 }))
    const ids = new Set(all.data.map((u) => u.id))
    expect(ids.has(ggB)).toBe(true)
    expect(ids.has(supA)).toBe(false)
    expect(all.data.every((u) => u.hotel.id.length > 0)).toBe(true)

    const withInactive = await service.directory(
      queryHotelUsersSchema.parse({ limit: 100, hotelId: hotelA, includeInactive: 'true' }),
    )
    expect(withInactive.data.some((u) => u.id === supA)).toBe(true)
    expect(withInactive.data.every((u) => u.hotel.id === hotelA)).toBe(true)

    const onlyGg = await service.directory(
      queryHotelUsersSchema.parse({ limit: 100, roleCode: 'ROL-H-03', hotelId: hotelB }),
    )
    expect(onlyGg.data.some((u) => u.id === ggB)).toBe(true)
    expect(onlyGg.data.every((u) => u.role.code === 'ROL-H-03' && u.hotel.id === hotelB)).toBe(true)
  })

  it('reenviar la invitación solo mientras no haya cuenta', async () => {
    const gg = await create(hotelA, { roleCode: 'ROL-H-03' })

    fetchMock.mockReset()
    fetchMock.mockImplementation(respondOk)
    const resent = await service.resendInvitation(hotelA, gg, auth)
    expect(resent.invitationSent).toBe(true)

    await db.user.update({ where: { id: gg }, data: { firebaseUid: `uid-${stamp}` } })
    await expect(service.resendInvitation(hotelA, gg, auth)).rejects.toMatchObject({
      response: { code: 'ALREADY_ACTIVATED' },
    })
  })
})

describe('las cuentas del hotel nacen en inglés', () => {
  it('sin elegir idioma, el Manager General del hotel nace en «en»', async () => {
    /* Hugo (2026-09-28): estas cuentas son del hotel CLIENTE, y los hoteles
       están en Georgia. Nacer en español dejaba a 38 Managers Generales
       recibiendo correos que no leen. El personal interno de Oranje sigue
       naciendo en español — eso lo cubre staff-users.spec. */
    const id = await create(hotelA, { roleCode: 'ROL-H-03' })

    const fila = await db.user.findUniqueOrThrow({ where: { id }, select: { locale: true } })
    expect(fila.locale).toBe('en')
  })

  it('quien da de alta puede elegir español igual', async () => {
    const id = await create(hotelA, { roleCode: 'ROL-H-03', locale: 'es' })

    const fila = await db.user.findUniqueOrThrow({ where: { id }, select: { locale: true } })
    expect(fila.locale).toBe('es')
  })
})

/**
 * Quién puede invitar cuentas del hotel (Hugo, 2026-09-30).
 *
 * El problema que lo motiva es de datos, no de opinión: en producción **34 de
 * 36 hoteles tienen un solo gerente y nadie más**, así que cuando rota no
 * queda nadie dentro para dar de alta al siguiente y todo cae en Oranje.
 *
 * Lo que se prueba aquí son los límites, que es donde se puede hacer daño:
 * el hotel ajeno, el rol que no toca y la excepción de la rotación.
 */
describe('invitar cuentas del hotel', () => {
  const desde = (roleCode: string, hotelId: string | null) => ({
    id: auth.id,
    roleCode,
    hotelId,
    departmentId: null,
  })

  it('el Manager General invita a cualquiera de SU hotel', async () => {
    const email = `inv-gm-${stamp}@oranje.local`
    const entity = await service.create(
      hotelA,
      dto({ email, roleCode: 'ROL-H-01' }),
      desde('ROL-H-03', hotelA),
    )
    createdUsers.push(entity.id)

    expect(entity.hotel.id).toBe(hotelA)
  })

  it('pero no en el hotel de al lado', async () => {
    await expect(
      service.create(
        hotelB,
        dto({ email: `inv-otro-${stamp}@oranje.local`, roleCode: 'ROL-H-01' }),
        desde('ROL-H-03', hotelA),
      ),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_OUT_OF_SCOPE' } })
  })

  it('el Supervisor no invita a nadie: desde el escalón más bajo se regalaría el hotel', async () => {
    await expect(
      service.create(
        hotelA,
        dto({ email: `inv-sup-${stamp}@oranje.local`, roleCode: 'ROL-H-03' }),
        desde('ROL-H-01', hotelA),
      ),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } })
  })

  it('el Manager de Área NO nombra gerente si el hotel ya tiene uno activo', async () => {
    /* hotelA ya tiene Manager General de las pruebas de arriba. */
    await expect(
      service.create(
        hotelA,
        dto({ email: `inv-ga-${stamp}@oranje.local`, roleCode: 'ROL-H-03' }),
        desde('ROL-H-02', hotelA),
      ),
    ).rejects.toMatchObject({ response: { code: 'HOTEL_HAS_GENERAL_MANAGER' } })
  })

  it('y SÍ lo nombra cuando el hotel se quedó sin ninguno: eso es la rotación', async () => {
    const huerfano = await hotel()

    const entity = await service.create(
      huerfano,
      dto({ email: `inv-rota-${stamp}@oranje.local`, roleCode: 'ROL-H-03' }),
      desde('ROL-H-02', huerfano),
    )
    createdUsers.push(entity.id)

    expect(entity.role.code).toBe('ROL-H-03')
  })

  it('el Manager de Área sí invita supervisores sin más condiciones', async () => {
    const entity = await service.create(
      hotelA,
      dto({ email: `inv-ga-sup-${stamp}@oranje.local`, roleCode: 'ROL-H-01' }),
      desde('ROL-H-02', hotelA),
    )
    createdUsers.push(entity.id)

    expect(entity.role.code).toBe('ROL-H-01')
  })
})

/**
 * El hotel propone, Oranje confirma (Hugo, 2026-09-30).
 *
 * Solo para las dos cuentas gerenciales y solo cuando la propone el hotel: si
 * invita Oranje, pedirle que se apruebe a sí misma sería ceremonia vacía.
 */
describe('las cuentas gerenciales que propone el hotel esperan visto bueno', () => {
  const desdeElHotel = (roleCode: string, hotelId: string) => ({
    id: auth.id,
    roleCode,
    hotelId,
    departmentId: null,
  })

  it('un gerente propuesto por el hotel nace inactivo y SIN invitación', async () => {
    const huerfano = await hotel()
    const entity = await service.create(
      huerfano,
      dto({ email: `pend-gm-${stamp}@oranje.local`, roleCode: 'ROL-H-03' }),
      desdeElHotel('ROL-H-02', huerfano),
    )
    createdUsers.push(entity.id)

    expect(entity.isActive).toBe(false)
    /* Mandar la invitación antes de aprobar le daría a la persona un enlace
       que la deja fuera: su cuenta todavía no entra. */
    expect(entity.invitationSent).toBe(false)
  })

  it('aparece en la cola del Administrador, y al aprobarla se activa y sale la invitación', async () => {
    const huerfano = await hotel()
    const propuesto = await service.create(
      huerfano,
      dto({ email: `pend-ok-${stamp}@oranje.local`, roleCode: 'ROL-H-03' }),
      desdeElHotel('ROL-H-02', huerfano),
    )
    createdUsers.push(propuesto.id)

    const cola = await service.pendingApprovals()
    expect(cola.map((row) => row.id)).toContain(propuesto.id)

    const aprobado = await service.approve(propuesto.id, auth)
    expect(aprobado.isActive).toBe(true)
    expect(aprobado.invitationSent).toBe(true)

    const journal = await db.journalEntry.findMany({
      where: { entityId: propuesto.id, eventType: 'HOTEL_USER_APPROVED' },
      select: { actorUserId: true },
    })
    expect(journal).toHaveLength(1)
  })

  it('aprobar dos veces no reenvía nada', async () => {
    const huerfano = await hotel()
    const propuesto = await service.create(
      huerfano,
      dto({ email: `pend-dos-${stamp}@oranje.local`, roleCode: 'ROL-H-03' }),
      desdeElHotel('ROL-H-02', huerfano),
    )
    createdUsers.push(propuesto.id)

    await service.approve(propuesto.id, auth)
    await expect(service.approve(propuesto.id, auth)).rejects.toMatchObject({
      response: { code: 'ALREADY_APPROVED' },
    })
  })

  it('un supervisor invitado por su gerente entra directo: la espera es solo para gerencia', async () => {
    const entity = await service.create(
      hotelA,
      dto({ email: `pend-sup-${stamp}@oranje.local`, roleCode: 'ROL-H-01' }),
      desdeElHotel('ROL-H-03', hotelA),
    )
    createdUsers.push(entity.id)

    expect(entity.isActive).toBe(true)
  })

  it('y si la propone el Administrador, tampoco espera', async () => {
    const entity = await service.create(
      hotelB,
      dto({ email: `pend-adm-${stamp}@oranje.local`, roleCode: 'ROL-H-03' }),
      auth,
    )
    createdUsers.push(entity.id)

    expect(entity.isActive).toBe(true)
  })
})
