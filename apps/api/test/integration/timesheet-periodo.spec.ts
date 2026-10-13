import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El periodo del Timesheet se filtra en la CONSULTA (Hugo, 2026-10-05).
 *
 * Antes el front pedía todas las semanas y recortaba en el navegador, así que
 * el tope del listado mordía antes de que el filtro actuara — y cuando muerde,
 * la pantalla enseña lo que quepa sin decir que cortó. Lo que se prueba aquí
 * es que el servidor acota de verdad, no que el navegador disimule.
 *
 * Y el criterio: una semana entra si **toca** el periodo, no si cabe entera.
 */
const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma), notifications)

let actorId: string
let hotelId: string
let workerId: string
const creados: string[] = []
const requisitions: string[] = []
const schedules: string[] = []
const sheets: string[] = []

/** Una semana de timesheet que empieza el lunes dado. */
async function semana(lunes: string): Promise<void> {
  const weekStart = new Date(`${lunes}T00:00:00Z`)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000)

  const schedule = await db.schedule.create({
    data: { id: uuidv7(), hotelId, weekStart, weekEnd, createdBy: actorId },
    select: { id: true },
  })
  schedules.push(schedule.id)

  const sheet = await db.timesheet.create({
    data: {
      id: uuidv7(),
      scheduleId: schedule.id,
      workerId,
      requisitionId: requisitions[0] as string,
      weekStart,
      weekEnd,
    },
    select: { id: true },
  })
  sheets.push(sheet.id)
}

/** El Observador: ve todos los hoteles, que es el alcance con el tope alto. */
function observador(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-OBS-01', hotelId: null, departmentId: null }
}

async function semanasEn(from?: string, to?: string): Promise<string[]> {
  const rows = await timesheets.list(observador(), undefined, true, { from, to })
  return rows.filter((row) => sheets.includes(row.id)).map((row) => row.weekStart)
}

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
      fullName: `periodo-${Date.now()}`,
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
  workerId = worker.id
  creados.push(worker.id)

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel Periodo ${Date.now()}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  })
  hotelId = hotel.id

  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const requisition = await db.requisition.create({
    data: {
      id: uuidv7(),
      number: `PER${Date.now()}${Math.floor(Math.random() * 1000)}`,
      hotelId,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
      createdBy: actorId,
    },
    select: { id: true },
  })
  requisitions.push(requisition.id)

  /* Cuatro semanas seguidas: la primera empieza en septiembre y TERMINA en
     octubre, que es el caso que distingue «toca» de «cabe entera». */
  await semana('2026-09-28')
  await semana('2026-10-05')
  await semana('2026-10-12')
  await semana('2026-10-19')
})

afterAll(async () => {
  await db.timesheet.deleteMany({ where: { id: { in: sheets } } })
  await db.schedule.deleteMany({ where: { id: { in: schedules } } })
  await db.requisition.deleteMany({ where: { id: { in: requisitions } } })
  await db.hotel.deleteMany({ where: { id: hotelId } })
  await db.worker.deleteMany({ where: { id: { in: creados } } })
  await close()
})

describe('el periodo lo filtra el servidor', () => {
  it('sin periodo devuelve las cuatro semanas', async () => {
    expect((await semanasEn()).sort()).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ])
  })

  it('incluye la semana que ARRANCA antes del periodo pero lo toca', async () => {
    /* Empieza el 28 de septiembre y termina el 4 de octubre: tiene días dentro
       de «del 1 al 20», así que quien pide ese periodo espera verla. */
    expect(await semanasEn('2026-10-01', '2026-10-20')).toContain('2026-09-28')
  })

  it('deja fuera la que termina antes de que empiece el periodo', async () => {
    expect(await semanasEn('2026-10-05', '2026-10-20')).not.toContain('2026-09-28')
  })

  it('deja fuera la que empieza después de que termina el periodo', async () => {
    expect((await semanasEn('2026-09-28', '2026-10-11')).sort()).toEqual([
      '2026-09-28',
      '2026-10-05',
    ])
  })

  it('un solo extremo ya acota', async () => {
    expect((await semanasEn('2026-10-12', undefined)).sort()).toEqual(['2026-10-12', '2026-10-19'])
    expect((await semanasEn(undefined, '2026-10-05')).sort()).toEqual(['2026-09-28', '2026-10-05'])
  })

  it('un periodo sin semanas devuelve vacío, no todo', async () => {
    expect(await semanasEn('2026-12-01', '2026-12-31')).toEqual([])
  })
})
