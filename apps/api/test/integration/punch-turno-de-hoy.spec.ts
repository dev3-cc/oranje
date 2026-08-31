import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import { PlacesService } from '../../src/infra/places/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SchedulesRepository } from '../../src/modules/operations/schedules/schedules.repository.js'
import { SchedulesService } from '../../src/modules/operations/schedules/schedules.service.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El Colaborador poncha sin conocer su asignación: ningún endpoint suyo la
 * exponía, así que el servidor resuelve el turno de HOY con la fecha local del
 * hotel.
 */

const prisma = db as unknown as PrismaService
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma))

const config = {
  get: (k: string) => (k === 'GOOGLE_MAPS_BROWSER_KEY' ? 'llave-de-prueba' : undefined),
}
const places = new PlacesService(config as never)
const schedules = new SchedulesService(new SchedulesRepository(prisma), places)

let actorId: string
let zoneId: string

const users: string[] = []
const workers: string[] = []
const hotels: string[] = []
const requisitions: string[] = []
const schedulesCreated: string[] = []

interface Turno {
  user: AuthenticatedUser
  workerId: string
  assignmentId: string
  hotelId: string
}

// Un colaborador con su hotel, su requisición, su asignación y su turno de hoy.
async function turnoDeHoy(etiqueta: string, photoRef: string | null = null): Promise<Turno> {
  const role = await db.role.findFirstOrThrow({ where: { code: 'ROL-C-01' } })
  const user = await db.user.create({
    data: { id: uuidv7(), email: `${etiqueta}@oranje.local`, fullName: etiqueta, roleId: role.id },
    select: { id: true },
  })

  users.push(user.id)

  const white = await db.statusLightState.findFirstOrThrow({
    where: { code: 'WHITE', statusLightCode: 'WORKER' },
    select: { id: true },
  })

  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      userId: user.id,
      fullName: etiqueta,
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

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel ${etiqueta}`,
      zoneId,
      timeZone: 'America/Cancun',
      photoRef,
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  })

  hotels.push(hotel.id)

  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'APPLE_GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })
  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `T${Date.now()}${Math.floor(Math.random() * 100)}`,
      hotelId: hotel.id,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
      createdBy: actorId,
    },
    select: { id: true },
  })

  requisitions.push(requisition.id)

  const pos = await db.position.create({
    data: {
      id: uuidv7(),
      requisitionId: requisition.id,
      lineNumber: 1,
      catalogPositionId: position.id,
      hiringModalityId: modality.id,
      hotelDepartmentId: department.id,
      quantity: 1,
      startDate: new Date(),
      startTime: new Date('1970-01-01T07:00:00Z'),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
    select: { id: true },
  })

  const slot = await db.slot.create({
    data: { id: uuidv7(), positionId: pos.id, ordinal: 1 },
    select: { id: true },
  })

  // `validity` es un daterange y Prisma no lo sabe escribir: va en SQL.
  const assignmentId = uuidv7()

  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${assignmentId}::uuid, ${slot.id}::uuid, ${worker.id}::uuid, 'FIXED',
            daterange(current_date - 1, NULL), 'ACTIVE', ${actorId}::uuid)`

  const assignment = { id: assignmentId }

  // La semana en curso, en la zona del hotel.
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setUTCDate(hoy.getUTCDate() - ((hoy.getUTCDay() + 6) % 7))

  const schedule = await db.schedule.create({
    data: {
      id: uuidv7(),
      hotelId: hotel.id,
      weekStart: new Date(`${lunes.toISOString().slice(0, 10)}T00:00:00Z`),
      weekEnd: new Date(
        `${new Date(lunes.getTime() + 6 * 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`,
      ),
      createdBy: actorId,
    },
    select: { id: true },
  })

  schedulesCreated.push(schedule.id)

  const fecha = await db.$queryRaw<Array<{ hoy: Date }>>`
    SELECT (now() AT TIME ZONE 'America/Cancun')::date AS hoy`

  const workDate = (fecha[0] as { hoy: Date }).hoy

  await db.$executeRaw`
    INSERT INTO operations.schedule_entry (id, schedule_id, assignment_id, worker_id, work_date, shift_range)
    VALUES (${uuidv7()}::uuid, ${schedule.id}::uuid, ${assignment.id}::uuid, ${worker.id}::uuid,
            ${workDate}::date,
            tstzrange(${workDate}::date + time '07:00', ${workDate}::date + time '15:00'))`

  return {
    user: { id: user.id, roleCode: 'ROL-C-01' } as AuthenticatedUser,
    workerId: worker.id,
    assignmentId: assignment.id,
    hotelId: hotel.id,
  }
}

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
})

afterAll(async () => {
  await db.$executeRaw`DELETE FROM operations.punch_mark WHERE timesheet_day_id IN (
    SELECT d.id FROM operations.timesheet_day d
      JOIN operations.timesheet t ON t.id = d.timesheet_id
     WHERE t.worker_id = ANY(${workers}::uuid[]))`
  await db.timesheetDay.deleteMany({ where: { timesheet: { workerId: { in: workers } } } })
  await db.timesheet.deleteMany({ where: { workerId: { in: workers } } })
  await db.scheduleEntry.deleteMany({ where: { workerId: { in: workers } } })
  await db.schedule.deleteMany({ where: { id: { in: schedulesCreated } } })
  await db.assignment.deleteMany({ where: { workerId: { in: workers } } })
  await db.slot.deleteMany({ where: { position: { requisitionId: { in: requisitions } } } })
  await db.position.deleteMany({ where: { requisitionId: { in: requisitions } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitions } } })
  await db.worker.deleteMany({ where: { id: { in: workers } } })
  await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  // El journal es inmutable (RR-16) y retiene al actor del ponche: al usuario
  // que dejó rastro no se le borra, se le desactiva.
  try {
    await db.user.deleteMany({ where: { id: { in: users } } })
  } catch {
    await db.user.updateMany({ where: { id: { in: users } }, data: { isActive: false } })
  }

  await close()
})

describe('ponchar sin conocer la asignación', () => {
  it('con turno hoy, el servidor lo resuelve solo', async () => {
    const t = await turnoDeHoy(`punch-hoy-${Date.now()}`)

    const result = await timesheets.punch(
      {
        type: 'CLOCK_IN',
        latitude: 21.16,
        longitude: -86.85,
        photoPath: 'operations/punch/x.webp',
      } as never,
      t.user,
    )

    expect(result).toBeTruthy()
  })

  it('sin turno hoy responde NO_SHIFT_TODAY', async () => {
    const t = await turnoDeHoy(`punch-sin-${Date.now()}`)

    await db.scheduleEntry.deleteMany({ where: { workerId: t.workerId } })

    await expect(
      timesheets.punch(
        {
          type: 'CLOCK_IN',
          latitude: 21.16,
          longitude: -86.85,
          photoPath: 'operations/punch/x.webp',
        } as never,
        t.user,
      ),
    ).rejects.toMatchObject({ response: { code: 'NO_SHIFT_TODAY' } })
  })

  it('no puede ponchar la asignación de otro', async () => {
    const mia = await turnoDeHoy(`punch-mia-${Date.now()}`)
    const ajena = await turnoDeHoy(`punch-ajena-${Date.now()}`)

    await expect(
      timesheets.punch(
        {
          assignmentId: ajena.assignmentId,
          type: 'CLOCK_IN',
          latitude: 21.16,
          longitude: -86.85,
          photoPath: 'operations/punch/x.webp',
        } as never,
        mia.user,
      ),
    ).rejects.toMatchObject({ response: { code: 'NOT_YOUR_ASSIGNMENT' } })
  })
})

describe('el turno propio trae con qué pintar el Inicio', () => {
  it('lleva assignmentId y la foto del hotel cuando hay photo_ref', async () => {
    const t = await turnoDeHoy(`sched-foto-${Date.now()}`, 'places/ChIJabc/photos/AXYZ')

    const ayer = new Date(Date.now() - 86_400_000)
    const manana = new Date(Date.now() + 86_400_000)
    const turnos = await schedules.mine(t.user, ayer, manana)

    expect(turnos).toHaveLength(1)
    expect(turnos[0]?.assignmentId).toBe(t.assignmentId)
    expect(turnos[0]?.hotelPhotoUrl).toContain('places/ChIJabc/photos/AXYZ/media')
  })

  it('sin photo_ref la foto va en null, no rompe', async () => {
    const t = await turnoDeHoy(`sched-sin-foto-${Date.now()}`)

    const turnos = await schedules.mine(
      t.user,
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    )

    expect(turnos[0]?.hotelPhotoUrl).toBeNull()
  })
})
