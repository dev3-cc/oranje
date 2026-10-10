import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El Timesheet de todos los hoteles (pedido de Hugo 2026-09-29): el Observador
 * lo lee para trabajar la nómina mientras se construye Contabilidad. Es un
 * alcance que se pide por permiso (`timesheet:read_all_hotels`), nunca uno que
 * salga de un `hotelId` vacío, y es solo de lectura.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma), notifications)

let actorId: string

const workers: string[] = []
const hotels: string[] = []
const requisitions: string[] = []
const schedules: string[] = []
const sheets: string[] = []

/** Un hotel con una requisición, su Schedule y un timesheet del colaborador. */
async function hotelConTimesheet(etiqueta: string, workerId: string): Promise<{ hotelId: string }> {
  const zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel ${etiqueta}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  })
  hotels.push(hotel.id)

  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `TH${Date.now()}${Math.floor(Math.random() * 1000)}`,
      hotelId: hotel.id,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
      createdBy: actorId,
    },
    select: { id: true },
  })
  requisitions.push(requisition.id)

  const weekStart = new Date('2026-09-21T00:00:00Z')
  const weekEnd = new Date('2026-09-27T00:00:00Z')

  const schedule = await db.schedule.create({
    data: { id: uuidv7(), hotelId: hotel.id, weekStart, weekEnd, createdBy: actorId },
    select: { id: true },
  })
  schedules.push(schedule.id)

  const sheet = await db.timesheet.create({
    data: {
      id: uuidv7(),
      scheduleId: schedule.id,
      workerId,
      requisitionId: requisition.id,
      weekStart,
      weekEnd,
    },
    select: { id: true },
  })
  sheets.push(sheet.id)

  return { hotelId: hotel.id }
}

let hotelA: string

beforeAll(async () => {
  actorId = (await actor()).id

  const zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  const white = await db.statusLightState.findFirstOrThrow({
    where: { code: 'WHITE', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: `todos-los-hoteles-${Date.now()}`,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000000',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: white.id,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
    select: { id: true },
  })
  workers.push(worker.id)

  hotelA = (await hotelConTimesheet(`todos-A-${Date.now()}`, worker.id)).hotelId
  await hotelConTimesheet(`todos-B-${Date.now()}`, worker.id)
})

afterAll(async () => {
  await db.timesheet.deleteMany({ where: { id: { in: sheets } } })
  await db.schedule.deleteMany({ where: { id: { in: schedules } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitions } } })
  await db.worker.deleteMany({ where: { id: { in: workers } } })
  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  await close()
})

describe('Timesheet de todos los hoteles', () => {
  it('con el alcance de todos los hoteles, llegan las semanas de cualquier hotel', async () => {
    const observer = {
      id: actorId,
      roleCode: 'ROL-OBS-01',
      hotelId: null,
      departmentId: null,
    } as AuthenticatedUser

    const ids = (await timesheets.list(observer, undefined, true)).map((sheet) => sheet.id)

    expect(ids).toEqual(expect.arrayContaining(sheets))
  })

  it('sin ese alcance, el Manager General sigue viendo solo su hotel', async () => {
    const manager = {
      id: actorId,
      roleCode: 'ROL-H-03',
      hotelId: hotelA,
      departmentId: null,
    } as AuthenticatedUser

    const ids = (await timesheets.list(manager, undefined, false)).map((sheet) => sheet.id)

    expect(ids).toContain(sheets[0])
    expect(ids).not.toContain(sheets[1])
  })

  it('el Observador lo tiene sembrado, sin ninguna escritura del Timesheet, y el hotel no lo hereda', async () => {
    const rows = await prisma.$queryRaw<Array<{ role: string; action: string }>>`
      SELECT r.code AS role, rp.action
        FROM identity.role_permission rp
        JOIN identity.role r ON r.id = rp.role_id
       WHERE rp.module = 'timesheet'`

    const observer = rows.filter((row) => row.role === 'ROL-OBS-01').map((row) => row.action)

    expect(observer).toEqual(['read_all_hotels'])
    // La Contadora y el Manager de Contabilidad lo ganaron después (Hugo,
    // 2026-09-29: "la Contadora verá el Timesheet completo de todos los
    // hoteles"), con el mismo permiso de solo lectura que el Observador.
    expect(rows.filter((row) => row.action === 'read_all_hotels').map((row) => row.role)).toEqual(
      expect.arrayContaining(['ROL-OBS-01', 'ROL-CO-01', 'ROL-CO-02']),
    )
  })
})
