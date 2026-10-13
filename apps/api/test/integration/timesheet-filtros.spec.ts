import { ForbiddenException } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'
import type { ListTimesheetsDto } from '../../src/modules/operations/timesheets/dto/list-timesheets.dto.js'
import { listTimesheetsSchema } from '../../src/modules/operations/timesheets/dto/list-timesheets.dto.js'
import { TimesheetsController } from '../../src/modules/operations/timesheets/timesheets.controller.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * GET /timesheets acepta `weekStart`, `hotelId` y `status`, y los filtra en SQL.
 * El permiso no cambia: sin alcance responde 403; con el de todos los hoteles
 * filtra sobre todos; con el de hotel propio, un `hotelId` ajeno no abre nada.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const service = new TimesheetsService(new TimesheetsRepository(prisma), notifications)
const permissions = new PermissionsService(prisma)
const controller = new TimesheetsController(service, permissions)

const WEEK_1 = '2027-08-02'
const WEEK_2 = '2027-08-09'

const ROLE_CONTADORA = 'ROL-CO-01'
const ROLE_SUPERVISOR = 'ROL-H-01'
const ROLE_COLABORADOR = 'ROL-C-01'

let actorId: string
let workerId: string
let hotelAId: string
let hotelBId: string
let sheetA1: string
let sheetA2: string
let sheetB1: string
let folioB1: string

const created: Array<{ table: string; id: string }> = []

async function hotel(label: string, zoneId: string): Promise<string> {
  const id = uuidv7()
  await db.hotel.create({
    data: { id, name: `Hotel filtros ${label} ${Date.now()}`, zoneId, timeZone: 'America/Cancun' },
  })
  created.push({ table: 'commercial.hotel', id })
  return id
}

/** Una requisición y su timesheet por semana: el folio es único por requisición. */
async function sheet(params: {
  hotelId: string
  folioBase: string
  weekStart: string
  reqState: string
}): Promise<{ id: string; folio: string }> {
  const requisitionId = uuidv7()
  const folio = `${params.folioBase}-${params.weekStart}`
  await db.requisition.create({
    data: {
      id: requisitionId,
      number: folio,
      hotelId: params.hotelId,
      statusLightStateId: params.reqState,
      statusLightCode: 'REQUISITION',
    },
  })
  created.push({ table: 'demand.requisition', id: requisitionId })

  const weekStart = new Date(`${params.weekStart}T00:00:00Z`)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000)

  const scheduleId = uuidv7()
  await db.schedule.create({
    data: { id: scheduleId, hotelId: params.hotelId, weekStart, weekEnd, createdBy: actorId },
  })
  created.push({ table: 'operations.schedule', id: scheduleId })

  const timesheetId = uuidv7()
  await db.timesheet.create({
    data: {
      id: timesheetId,
      scheduleId,
      workerId,
      requisitionId,
      weekStart,
      weekEnd,
    },
  })
  created.push({ table: 'operations.timesheet', id: timesheetId })

  return { id: timesheetId, folio }
}

beforeAll(async () => {
  actorId = (await actor()).id

  const stamp = Date.now()
  const zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  const workerState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'WHITE', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })

  workerId = uuidv7()
  await db.worker.create({
    data: {
      id: workerId,
      fullName: `Filtros ${stamp}`,
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000003',
      address: 'Calle 1',
      zoneId,
      statusLightStateId: workerState.id,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
  })
  created.push({ table: 'personal.worker', id: workerId })

  hotelAId = await hotel('A', zoneId)
  hotelBId = await hotel('B', zoneId)
  const a1 = await sheet({
    hotelId: hotelAId,
    folioBase: `FLT-A-${stamp}`,
    weekStart: WEEK_1,
    reqState: reqState.id,
  })
  const a2 = await sheet({
    hotelId: hotelAId,
    folioBase: `FLT-A-${stamp}`,
    weekStart: WEEK_2,
    reqState: reqState.id,
  })
  const b1 = await sheet({
    hotelId: hotelBId,
    folioBase: `FLT-B-${stamp}`,
    weekStart: WEEK_1,
    reqState: reqState.id,
  })
  sheetA1 = a1.id
  sheetA2 = a2.id
  sheetB1 = b1.id
  folioB1 = b1.folio
})

afterAll(async () => {
  for (const row of [...created].reverse()) {
    await db.$executeRawUnsafe(`DELETE FROM ${row.table} WHERE id = $1::uuid`, row.id)
  }
  await close()
})

const contadora = {
  id: '',
  roleCode: ROLE_CONTADORA,
  hotelId: null,
  departmentId: null,
} as unknown as AuthenticatedUser
const supervisorA = {
  id: '',
  roleCode: ROLE_SUPERVISOR,
  hotelId: '',
  departmentId: null,
} as unknown as AuthenticatedUser

function query(raw: Record<string, string>): ListTimesheetsDto {
  return listTimesheetsSchema.parse(raw)
}

async function list(user: AuthenticatedUser, raw: Record<string, string> = {}): Promise<string[]> {
  const { data } = await controller.list(user, query(raw))
  return data.map((row) => row.id)
}

describe('GET /timesheets: permiso y filtros', () => {
  beforeAll(() => {
    contadora.id = actorId
    supervisorA.id = actorId
    supervisorA.hotelId = hotelAId
  })

  it('sin permiso de lectura responde 403', async () => {
    const colaborador = {
      id: actorId,
      roleCode: ROLE_COLABORADOR,
      hotelId: null,
      departmentId: null,
    } as unknown as AuthenticatedUser

    await expect(controller.list(colaborador, query({}))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('sin parámetros devuelve las semanas de todos los hoteles, como antes', async () => {
    const ids = await list(contadora)

    expect(ids).toEqual(expect.arrayContaining([sheetA1, sheetA2, sheetB1]))
  })

  it('weekStart acota a esa semana en todos los hoteles', async () => {
    const ids = await list(contadora, { weekStart: WEEK_1 })

    expect(ids).toEqual(expect.arrayContaining([sheetA1, sheetB1]))
    expect(ids).not.toContain(sheetA2)
  })

  it('hotelId acota a ese hotel', async () => {
    const ids = await list(contadora, { hotelId: hotelAId })

    expect(ids).toEqual(expect.arrayContaining([sheetA1, sheetA2]))
    expect(ids).not.toContain(sheetB1)
  })

  it('weekStart y hotelId juntos dan exactamente una fila', async () => {
    const ids = await list(contadora, { weekStart: WEEK_1, hotelId: hotelBId })

    expect(ids).toContain(sheetB1)
    expect(ids).not.toContain(sheetA1)
    expect(ids).not.toContain(sheetA2)
  })

  it('cada fila trae el hotel (id y nombre) y el folio de la requisición', async () => {
    const { data } = await controller.list(
      contadora,
      query({ hotelId: hotelBId, weekStart: WEEK_1 }),
    )
    const row = data.find((r) => r.id === sheetB1)

    expect(row?.hotel.id).toBe(hotelBId)
    expect(row?.hotel.name).toMatch(/^Hotel filtros B /)
    expect(row?.requisitionFolio).toBe(folioB1)
  })

  it('un hotelId ajeno no abre otro hotel al supervisor', async () => {
    const ids = await list(supervisorA, { hotelId: hotelBId })

    expect(ids).not.toContain(sheetB1)
    expect(ids).toEqual([])
  })

  it('el supervisor sin filtros solo ve su hotel', async () => {
    const ids = await list(supervisorA)

    expect(ids).toEqual(expect.arrayContaining([sheetA1, sheetA2]))
    expect(ids).not.toContain(sheetB1)
  })

  it('weekStart debe ser un lunes en AAAA-MM-DD', () => {
    expect(listTimesheetsSchema.safeParse({ weekStart: WEEK_1 }).success).toBe(true)
    expect(listTimesheetsSchema.safeParse({ weekStart: '2027-08-03' }).success).toBe(false)
    expect(listTimesheetsSchema.safeParse({ weekStart: '2027-8-2' }).success).toBe(false)
    expect(listTimesheetsSchema.safeParse({ hotelId: 'no-es-uuid' }).success).toBe(false)
  })
})
