import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { PaymentLimitsService } from '../../src/modules/settings/payment-limits.service.js'
import { PaymentRunsRepository } from '../../src/modules/settlement/payment-runs/payment-runs.repository.js'
import { PaymentRunsService } from '../../src/modules/settlement/payment-runs/payment-runs.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import { describeIfMigrated } from './payment-fixture.js'

/**
 * El consolidado es de un colaborador, UN hotel y UNA semana (P-CO-12, decisión
 * de Hugo 2026-10-05). Quien trabaja en dos hoteles la misma semana recibe dos
 * consolidados, cada uno con sus propios montos.
 *
 * Se genera con la corrida de pago del miércoles (POST /payment-runs). Si el
 * hotel no entra en el GROUP BY, los dos hoteles se suman en un solo pago y la
 * prueba lo delata.
 */

const prisma = db as unknown as PrismaService

const WEEK_START = '2027-06-07'
// Corte del miércoles 16 de junio (16:00 Cancún); la corrida corre después.
const RUN_AT = new Date('2027-06-20T00:00:00Z')
const LUNCH = 30
const GROSS_PER_DAY = 480

// Hotel A: dos jornadas a 20.00/h → 15 h → 300.00.
// Hotel B: una jornada a 30.00/h → 7.5 h → 225.00.
const HOTEL_A = { days: 2, payRate: 20, expected: 300 }
const HOTEL_B = { days: 1, payRate: 30, expected: 225 }

// Tarifa de un concepto (p. ej. «Uber»): no es la base del pago. Si el generador
// la tomara, el hotel A pagaría 15 h a 99.00.
const CONCEPT_RATE = 99

const created: Array<{ table: string; id: string }> = []

let actorId: string
let user: AuthenticatedUser
let workerId: string
let hotelAId: string
let hotelBId: string

interface HotelWeek {
  hotelId: string
  days: number
  payRate: number
}

async function seedHotelWeek(params: {
  label: string
  days: number
  payRate: number
  zoneId: string
  positionId: string
  modalityId: string
  departmentId: string
  coverageStateId: string
  reqStateId: string
}): Promise<HotelWeek> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  const hotelId = uuidv7()
  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel ${params.label} ${stamp}`,
      zoneId: params.zoneId,
      timeZone: 'America/Cancun',
    },
  })
  created.push({ table: 'commercial.hotel', id: hotelId })

  const contractId = uuidv7()
  await db.$executeRaw`
    INSERT INTO commercial.contract
      (id, hotel_id, number, status, valid_from, week_start_day, week_end_day,
       overtime_bill_multiplier, overtime_pay_multiplier)
    VALUES (${contractId}::uuid, ${hotelId}::uuid, ${`CONS${stamp}`}, 'ACTIVE',
            ${WEEK_START}::date, 1, 0, 1.5, 1)`
  created.push({ table: 'commercial.contract', id: contractId })

  const rateId = uuidv7()
  await db.$executeRaw`
    INSERT INTO commercial.contract_rate (id, contract_id, catalog_position_id, pay_rate, bill_rate)
    VALUES (${rateId}::uuid, ${contractId}::uuid, ${params.positionId}::uuid,
            ${params.payRate}::numeric, ${params.payRate + 10}::numeric)`
  created.push({ table: 'commercial.contract_rate', id: rateId })

  const requisitionId = uuidv7()
  await db.requisition.create({
    data: {
      id: requisitionId,
      number: `CONS${stamp}`,
      hotelId,
      statusLightStateId: params.reqStateId,
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
      catalogPositionId: params.positionId,
      hiringModalityId: params.modalityId,
      hotelDepartmentId: params.departmentId,
      quantity: 1,
      startDate: new Date(WEEK_START),
      coverageStateId: params.coverageStateId,
      coverageLightCode: 'POSITION_COVERAGE',
    },
  })
  created.push({ table: 'demand."position"', id: positionId })

  const scheduleId = uuidv7()
  await db.schedule.create({
    data: {
      id: scheduleId,
      hotelId,
      weekStart: new Date(WEEK_START),
      weekEnd: new Date('2027-06-13'),
      createdBy: actorId,
    },
  })
  created.push({ table: 'operations.schedule', id: scheduleId })

  const timesheetId = uuidv7()
  await db.timesheet.create({
    data: {
      id: timesheetId,
      scheduleId,
      workerId,
      requisitionId,
      weekStart: new Date(WEEK_START),
      weekEnd: new Date('2027-06-13'),
      status: 'APPROVED',
      approvedBy: actorId,
      approvedAt: new Date(),
    },
  })
  created.push({ table: 'operations.timesheet', id: timesheetId })

  for (let i = 0; i < params.days; i += 1) {
    const day = new Date(WEEK_START)
    day.setUTCDate(day.getUTCDate() + i)

    const dayId = uuidv7()
    await db.timesheetDay.create({
      data: {
        id: dayId,
        timesheetId,
        workDate: day,
        grossMinutes: GROSS_PER_DAY,
        lunchDeductionMinutes: LUNCH,
        overtimeMinutes: 0,
      },
    })
    created.push({ table: 'operations.timesheet_day', id: dayId })
  }

  return { hotelId, days: params.days, payRate: params.payRate }
}

beforeAll(async () => {
  actorId = (await actor()).id
  user = { id: actorId, roleCode: 'ROL-SYS-01' } as unknown as AuthenticatedUser

  const stamp = Date.now()
  const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
  const position = await db.catalogPosition.findFirstOrThrow({ select: { id: true } })
  const modality = await db.hiringModality.findFirstOrThrow({ select: { id: true } })
  const department = await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })
  const workerState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })
  const reqState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'LIGHT_BLUE', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  workerId = uuidv7()
  await db.worker.create({
    data: {
      id: workerId,
      fullName: `Dos hoteles ${stamp}`,
      birthDate: new Date('1990-01-01'),
      gender: 'OTHER',
      phone: '9990000002',
      address: 'calle de prueba',
      zoneId: zone.id,
      statusLightStateId: workerState.id,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
  })
  created.push({ table: 'personal.worker', id: workerId })

  const common = {
    zoneId: zone.id,
    positionId: position.id,
    modalityId: modality.id,
    departmentId: department.id,
    coverageStateId: coverage.id,
    reqStateId: reqState.id,
  }

  const a = await seedHotelWeek({
    label: 'A',
    days: HOTEL_A.days,
    payRate: HOTEL_A.payRate,
    ...common,
  })
  const b = await seedHotelWeek({
    label: 'B',
    days: HOTEL_B.days,
    payRate: HOTEL_B.payRate,
    ...common,
  })
  hotelAId = a.hotelId
  hotelBId = b.hotelId

  // Tarifa de concepto vigente para el mismo colaborador, sin posición.
  const conceptId = uuidv7()
  await db.payConcept.create({
    data: { id: conceptId, code: `UBER_${stamp}`, name: `Uber ${stamp}` },
  })
  created.push({ table: 'catalogs.pay_concept', id: conceptId })

  const conceptRateId = uuidv7()
  await db.workerRate.create({
    data: {
      id: conceptRateId,
      workerId,
      payConceptId: conceptId,
      rate: CONCEPT_RATE,
      validFrom: new Date('2027-01-01'),
      authorizedBy: actorId,
    },
  })
  created.push({ table: 'personal.worker_rate', id: conceptRateId })
})

/** Corre el miércoles para los dos hoteles de la prueba, como lo haría Contabilidad. */
async function runWednesdayCut(): Promise<void> {
  const settings = new SettingsService(prisma)
  const limits = new PaymentLimitsService(prisma, settings)
  const runs = new PaymentRunsService(new PaymentRunsRepository(prisma), limits, prisma)

  for (const hotelId of [hotelAId, hotelBId]) {
    await runs.run({ weekStart: WEEK_START, slot: 'WEDNESDAY_CUT', hotelId }, user, RUN_AT)
  }
}

afterAll(async () => {
  await db.$executeRaw`
    DELETE FROM settlement.consolidation_detail
     WHERE consolidation_id IN (SELECT id FROM settlement.consolidation WHERE worker_id = ${workerId}::uuid)`
  await db.$executeRaw`DELETE FROM settlement.consolidation WHERE worker_id = ${workerId}::uuid`

  for (const row of [...created].reverse()) {
    await db.$executeRawUnsafe(`DELETE FROM ${row.table} WHERE id = $1::uuid`, row.id)
  }

  await close()
})

async function consolidationsOfWorker(): Promise<
  Array<{ hotelId: string; gross: string; net: string }>
> {
  return db.$queryRaw`
    SELECT hotel_id::text AS "hotelId", gross_amount::text AS gross, net_amount::text AS net
      FROM settlement.consolidation
     WHERE worker_id = ${workerId}::uuid
     ORDER BY hotel_id`
}

describeIfMigrated('consolidado por colaborador, hotel y semana', () => {
  it('mismo colaborador, dos hoteles, misma semana: dos consolidados', async () => {
    await runWednesdayCut()

    const rows = await consolidationsOfWorker()

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.hotelId).sort()).toEqual([hotelAId, hotelBId].sort())
  })

  it('cada consolidado suma solo las horas de su hotel, con su tarifa', async () => {
    const rows = await consolidationsOfWorker()
    const byHotel = new Map(rows.map((r) => [r.hotelId, Number(r.gross)]))

    expect(byHotel.get(hotelAId)).toBe(HOTEL_A.expected)
    expect(byHotel.get(hotelBId)).toBe(HOTEL_B.expected)
  })

  it('la tarifa de un concepto no reemplaza la tarifa base del pago', async () => {
    const rows = await consolidationsOfWorker()
    const a = rows.find((r) => r.hotelId === hotelAId)

    expect(Number(a?.gross)).toBe(HOTEL_A.expected)
  })

  it('cada detalle cuelga del consolidado de su mismo hotel', async () => {
    const rows = await db.$queryRaw<Array<{ mismatches: bigint }>>`
      SELECT count(*) AS mismatches
        FROM settlement.consolidation_detail d
        JOIN settlement.consolidation c ON c.id = d.consolidation_id
       WHERE c.worker_id = ${workerId}::uuid
         AND d.hotel_id <> c.hotel_id`

    expect(Number(rows[0]?.mismatches ?? 0)).toBe(0)
  })

  it('volver a generar la semana no duplica los consolidados del colaborador', async () => {
    await runWednesdayCut()

    const rows = await consolidationsOfWorker()

    expect(rows).toHaveLength(2)
  })
})
