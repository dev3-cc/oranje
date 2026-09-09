import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import { PlacesService } from '../../src/infra/places/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { RequisitionsRepository } from '../../src/modules/demand/requisitions/requisitions.repository.js'
import { RequisitionsService } from '../../src/modules/demand/requisitions/requisitions.service.js'
import { PermissionsService } from '../../src/modules/identity/index.js'
import { SchedulesRepository } from '../../src/modules/operations/schedules/schedules.repository.js'
import { SchedulesService } from '../../src/modules/operations/schedules/schedules.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * El Schedule se ve y se planea por departamento (Reglas del Hotel · resumen
 * por rol): el Supervisor y el Manager de Área solo el suyo, el Manager General
 * todo el hotel. El alcance viene de `identity.user.department_id` (D-09).
 */

const prisma = db as unknown as PrismaService
const places = new PlacesService({ get: () => undefined } as never)
const requisitions = new RequisitionsService(
  new RequisitionsRepository(prisma),
  new PermissionsService(prisma),
  places,
  { signedUrl: (): Promise<null> => Promise.resolve(null) } as never,
)
const schedules = new SchedulesService(new SchedulesRepository(prisma), places)

let hotelId: string
let zoneId: string
let departmentId: string
let otherDepartmentId: string
let positionId: string
let modalityId: string
const users: string[] = []
const workers: string[] = []
const requisitionIds: string[] = []
let scheduleId: string | null = null

async function usuario(roleCode: string, etiqueta: string, departmentId: string | null) {
  const role = await db.role.findFirstOrThrow({ where: { code: roleCode } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `${etiqueta}-${Date.now()}@oranje.local`,
      fullName: etiqueta,
      roleId: role.id,
      hotelId,
      departmentId,
    },
    select: { id: true },
  })
  users.push(user.id)

  return { id: user.id, roleCode, hotelId, departmentId } as AuthenticatedUser
}

async function colaborador(): Promise<string> {
  const actorId = (await actor()).id
  const white = await db.statusLightState.findFirstOrThrow({
    where: { code: 'WHITE', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const worker = await db.worker.create({
    data: {
      id: uuidv7(),
      fullName: 'Colaborador del turno',
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      phone: '9990000001',
      address: 'Calle 2',
      zoneId,
      statusLightStateId: white.id,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
    select: { id: true },
  })
  workers.push(worker.id)

  return worker.id
}

/** Una asignación ACTIVE en una requisición autorizada del departamento dado. */
async function asignacion(department: string, gm: AuthenticatedUser): Promise<string> {
  const entity = await requisitions.create(
    {
      hotelId,
      positions: [
        {
          catalogPositionId: positionId,
          hiringModalityId: modalityId,
          hotelDepartmentId: department,
          quantity: 1,
          startDate: new Date(Date.now() + 7 * 86_400_000),
        },
      ],
    },
    gm,
  )
  requisitionIds.push(entity.id)
  await requisitions.authorize(entity.id, gm)

  const slot = await db.slot.findFirstOrThrow({
    where: { position: { requisitionId: entity.id } },
    select: { id: true },
  })
  const workerId = await colaborador()
  const id = uuidv7()

  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${id}::uuid, ${slot.id}::uuid, ${workerId}::uuid, 'FIXED',
            daterange(current_date, NULL), 'ACTIVE', ${gm.id}::uuid)`

  return id
}

/** El lunes de dentro de dos semanas: ninguna otra prueba lo ocupa. */
function nextMonday(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7) + 7)
  return d
}

beforeAll(async () => {
  const actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  const [dept, other] = await db.hotelDepartment.findMany({ select: { id: true }, take: 2 })
  departmentId = dept!.id
  otherDepartmentId = other!.id
  positionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  modalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id

  const hotel = await db.hotel.create({
    data: {
      id: uuidv7(),
      name: `Hotel Schedule ${Date.now()}`,
      zoneId,
      timeZone: 'America/Cancun',
      createdBy: actorId,
    },
    select: { id: true },
  })
  hotelId = hotel.id
})

afterAll(async () => {
  if (scheduleId) {
    await db.$executeRaw`DELETE FROM operations.schedule_entry WHERE schedule_id = ${scheduleId}::uuid`
    await db.journalEntry.deleteMany({ where: { entityId: scheduleId } })
    await db.$executeRaw`DELETE FROM operations.schedule WHERE id = ${scheduleId}::uuid`
  }
  await db.$executeRaw`DELETE FROM coverage.assignment WHERE worker_id = ANY(${workers}::uuid[])`
  await db.journalEntry.deleteMany({ where: { entityId: { in: [...requisitionIds, ...workers] } } })
  for (const id of requisitionIds) {
    await db.$executeRaw`DELETE FROM demand.requisition_state_history WHERE requisition_id = ${id}::uuid`
    await db.$executeRaw`DELETE FROM demand.slot WHERE position_id IN (SELECT id FROM demand.position WHERE requisition_id = ${id}::uuid)`
    await db.$executeRaw`DELETE FROM demand.position WHERE requisition_id = ${id}::uuid`
    await db.$executeRaw`DELETE FROM demand.requisition WHERE id = ${id}::uuid`
  }
  await db.worker.deleteMany({ where: { id: { in: workers } } })
  // El journal firma con el actor: lo que escribieron estos usuarios se va con ellos.
  await db.journalEntry.deleteMany({
    where: { OR: [{ entityId: { in: users } }, { actorUserId: { in: users } }] },
  })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.hotel.deleteMany({ where: { id: hotelId } })
  await close()
})

describe('el Schedule se planea y se ve por departamento', () => {
  it('el Manager de Área solo planea y ve turnos de su departamento; el General, todo', async () => {
    const gm = await usuario('ROL-H-03', 'gm-sched', null)
    const gaPropio = await usuario('ROL-H-02', 'ga-sched-propio', departmentId)
    const gaAjeno = await usuario('ROL-H-02', 'ga-sched-ajeno', otherDepartmentId)
    const supAjeno = await usuario('ROL-H-01', 'sup-sched-ajeno', otherDepartmentId)

    const assignmentId = await asignacion(departmentId, gm)
    const weekStart = nextMonday()
    const schedule = await schedules.create({ hotelId, weekStart }, gm)
    scheduleId = schedule.id
    const workDate = new Date(weekStart)
    workDate.setUTCDate(workDate.getUTCDate() + 1)
    const dto = { assignmentId, workDate, startTime: '07:00', endTime: '15:00' } as never

    // Otro departamento: ni planea…
    await expect(schedules.addEntry(schedule.id, dto, gaAjeno)).rejects.toMatchObject({
      response: { code: 'DEPARTMENT_OUT_OF_SCOPE' },
    })

    // …el suyo sí.
    const entry = await schedules.addEntry(schedule.id, dto, gaPropio)
    expect(entry.assignmentId).toBe(assignmentId)

    // Y al leer, cada quien ve lo suyo: el General todo, el ajeno nada.
    expect((await schedules.entries(schedule.id, gm)).map((e) => e.id)).toEqual([entry.id])
    expect((await schedules.entries(schedule.id, gaPropio)).map((e) => e.id)).toEqual([entry.id])
    expect(await schedules.entries(schedule.id, supAjeno)).toEqual([])

    // Quitarlo tampoco es del ajeno.
    await expect(schedules.removeEntry(schedule.id, entry.id, gaAjeno)).rejects.toMatchObject({
      response: { code: 'DEPARTMENT_OUT_OF_SCOPE' },
    })
    await schedules.removeEntry(schedule.id, entry.id, gaPropio)
    expect(await schedules.entries(schedule.id, gm)).toEqual([])
    // Doce viajes a Cloud SQL por el proxy: el tope default de 30 s no alcanza.
  }, 120_000)
})
