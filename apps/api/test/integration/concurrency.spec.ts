import { v7 as uuidv7 } from 'uuid'

import { close, db } from './db.js'

/**
 * Las tres carreras que la base tiene que perder sola, sin ayuda de la
 * aplicación. Un `SELECT` previo seguido de un `INSERT` deja una ventana entre
 * los dos por la que dos peticiones simultáneas se cuelan; una restricción no
 * tiene ventana.
 *
 * Cada caso inserta el conflicto A PROPÓSITO y espera el error del motor. Si
 * alguien borra el índice, este test truena — que es justo para lo que existe.
 */

let hotelId: string
let workerId: string
let otherWorkerId: string
let slotId: string
let assignmentId: string | null = null

const created: Array<{ table: string; id: string }> = []

async function seedFixture(): Promise<void> {
  const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })
  const actor = await db.user.findFirstOrThrow({ select: { id: true } })
  const workerState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'YELLOW', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { code: 'ORANGE', statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  const stamp = Date.now()

  hotelId = uuidv7()
  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Concurrencia ${stamp}`,
      zoneId: zone.id,
      timeZone: 'America/Cancun',
    },
  })
  created.push({ table: 'commercial.hotel', id: hotelId })

  const makeWorker = async (suffix: string): Promise<string> => {
    const id = uuidv7()
    await db.worker.create({
      data: {
        id,
        fullName: `Prueba Concurrencia ${suffix}`,
        birthDate: new Date('1990-01-01'),
        gender: 'OTHER',
        phone: '9990000000',
        address: 'calle de prueba',
        zoneId: zone.id,
        statusLightStateId: workerState.id,
        statusLightCode: 'WORKER',
        createdBy: actor.id,
      },
    })
    created.push({ table: 'personal.worker', id })

    return id
  }

  workerId = await makeWorker('A')
  otherWorkerId = await makeWorker('B')

  const requisitionId = uuidv7()
  await db.requisition.create({
    data: {
      id: requisitionId,
      number: `TEST${stamp}`,
      hotelId,
      statusLightStateId: reqState.id,
      statusLightCode: 'REQUISITION',
    },
  })
  created.push({ table: 'demand.requisition', id: requisitionId })

  const positionId = uuidv7()
  await db.position.create({
    data: {
      id: positionId,
      requisitionId,
      lineNumber: 1,
      catalogPositionId: position.id,
      hiringModalityId: modality.id,
      hotelDepartmentId: department.id,
      quantity: 1,
      startDate: new Date(),
      coverageStateId: coverage.id,
      coverageLightCode: 'POSITION_COVERAGE',
    },
  })
  created.push({ table: 'demand."position"', id: positionId })

  slotId = uuidv7()
  await db.slot.create({ data: { id: slotId, positionId, ordinal: 1 } })
  created.push({ table: 'demand.slot', id: slotId })
}

async function assign(worker: string): Promise<string> {
  const id = uuidv7()
  const actor = await db.user.findFirstOrThrow({ select: { id: true } })

  await db.$executeRaw`
    INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
    VALUES (${id}::uuid, ${slotId}::uuid, ${worker}::uuid, 'FIXED',
            daterange(current_date, null), 'ACTIVE', ${actor.id}::uuid)`

  created.push({ table: 'coverage.assignment', id })

  return id
}

beforeAll(seedFixture)

afterAll(async () => {
  for (const row of [...created].reverse()) {
    await db.$executeRawUnsafe(`DELETE FROM ${row.table} WHERE id = $1::uuid`, row.id)
  }

  await close()
})

describe('un slot no admite dos asignaciones activas', () => {
  it('la primera entra', async () => {
    assignmentId = await assign(workerId)

    expect(assignmentId).toHaveLength(36)
  })

  it('la segunda rebota contra ux_slot_active_assignment', async () => {
    await expect(assign(otherWorkerId)).rejects.toThrow(/ux_slot_active_assignment|23505/)
  })

  it('y sí entra cuando la primera se cancela', async () => {
    await db.assignment.update({
      where: { id: assignmentId as string },
      data: { status: 'CANCELLED', closedReason: 'prueba de concurrencia' },
    })

    await expect(assign(otherWorkerId)).resolves.toHaveLength(36)
  })
})

describe('RR-05 · el mismo colaborador no puede tener turnos encimados', () => {
  let scheduleId: string
  let assignment: string

  beforeAll(async () => {
    const actor = await db.user.findFirstOrThrow({ select: { id: true } })
    const monday = new Date('2027-03-01')

    scheduleId = uuidv7()
    await db.schedule.create({
      data: {
        id: scheduleId,
        hotelId,
        weekStart: monday,
        weekEnd: new Date('2027-03-07'),
        createdBy: actor.id,
      },
    })
    created.push({ table: 'operations.schedule', id: scheduleId })

    assignment = created.filter((c) => c.table === 'coverage.assignment').slice(-1)[0]!.id
  })

  const plan = async (from: string, to: string): Promise<string> => {
    const id = uuidv7()

    await db.$executeRaw`
      INSERT INTO operations.schedule_entry
        (id, schedule_id, assignment_id, worker_id, work_date, shift_range)
      VALUES (${id}::uuid, ${scheduleId}::uuid, ${assignment}::uuid, ${otherWorkerId}::uuid,
              '2027-03-02'::date,
              tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)'))`

    created.push({ table: 'operations.schedule_entry', id })

    return id
  }

  it('el turno de la mañana entra', async () => {
    await expect(plan('2027-03-02T07:00:00Z', '2027-03-02T15:00:00Z')).resolves.toHaveLength(36)
  })

  it('uno que se encima rebota contra no_shift_overlap', async () => {
    await expect(plan('2027-03-02T14:00:00Z', '2027-03-02T22:00:00Z')).rejects.toThrow(
      /no_shift_overlap|23P01/,
    )
  })

  it('pero uno pegado sí entra: el criterio son las horas, no el día', async () => {
    await expect(plan('2027-03-02T15:00:00Z', '2027-03-02T23:00:00Z')).resolves.toHaveLength(36)
  })
})
