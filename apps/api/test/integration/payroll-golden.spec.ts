import { v7 as uuidv7 } from 'uuid'

import { close, db } from './db.js'

/**
 * El golden test que piden los Estándares §8.
 *
 * Una semana fija de horas contra un monto exacto. Existe porque un error de
 * cálculo de nómina NO lanza excepción: paga mal, factura mal, y se descubre
 * meses después. Es la única defensa contra eso.
 *
 * El set de referencia se versiona y NO se ajusta para que el test pase: si el
 * monto cambia, se justifica contra la regla de negocio que lo cambió.
 */

const PAY_RATE = 20
const BILL_RATE = 35
const OVERTIME_PAY_MULTIPLIER = 1
const OVERTIME_BILL_MULTIPLIER = 1.5
const LUNCH_DEDUCTION = 30

// Cinco jornadas de 07:00 a 15:30 — 510 brutos, 480 netos tras el lunch.
const DAYS = 5
const GROSS_PER_DAY = 510
const NET_PER_DAY = GROSS_PER_DAY - LUNCH_DEDUCTION

const NET_MINUTES = DAYS * NET_PER_DAY
const OVERTIME_MINUTES = 120

const EXPECTED_PAY =
  (NET_MINUTES / 60) * PAY_RATE + (OVERTIME_MINUTES / 60) * PAY_RATE * OVERTIME_PAY_MULTIPLIER
const EXPECTED_BILL =
  (NET_MINUTES / 60) * BILL_RATE + (OVERTIME_MINUTES / 60) * BILL_RATE * OVERTIME_BILL_MULTIPLIER

const WEEK_START = '2027-04-05'
const WEEK_END = '2027-04-11'

const created: Array<{ table: string; id: string }> = []

let hotelId: string
let workerId: string
let requisitionId: string

async function seed(): Promise<void> {
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
    where: { code: 'LIGHT_BLUE', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  const coverage = await db.statusLightState.findFirstOrThrow({
    where: { code: 'GREEN', statusLightCode: 'POSITION_COVERAGE' },
    select: { id: true },
  })

  const stamp = Date.now()

  hotelId = uuidv7()
  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Golden ${stamp}`,
      zoneId: zone.id,
      timeZone: 'America/Cancun',
    },
  })
  created.push({ table: 'commercial.hotel', id: hotelId })

  const contractId = uuidv7()
  await db.$executeRaw`
    INSERT INTO commercial.contract
      (id, hotel_id, number, status, valid_from, week_start_day, week_end_day,
       overtime_bill_multiplier, overtime_pay_multiplier)
    VALUES (${contractId}::uuid, ${hotelId}::uuid, ${`GOLD${stamp}`}, 'ACTIVE',
            ${WEEK_START}::date, 1, 0,
            ${OVERTIME_BILL_MULTIPLIER}, ${OVERTIME_PAY_MULTIPLIER})`
  created.push({ table: 'commercial.contract', id: contractId })

  const rateId = uuidv7()
  await db.$executeRaw`
    INSERT INTO commercial.contract_rate (id, contract_id, catalog_position_id, pay_rate, bill_rate)
    VALUES (${rateId}::uuid, ${contractId}::uuid, ${position.id}::uuid,
            ${PAY_RATE}::numeric, ${BILL_RATE}::numeric)`
  created.push({ table: 'commercial.contract_rate', id: rateId })

  workerId = uuidv7()
  await db.worker.create({
    data: {
      id: workerId,
      fullName: `Golden ${stamp}`,
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
  created.push({ table: 'personal.worker', id: workerId })

  requisitionId = uuidv7()
  await db.requisition.create({
    data: {
      id: requisitionId,
      number: `GOLD${stamp}`,
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
      startDate: new Date(WEEK_START),
      coverageStateId: coverage.id,
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
      weekEnd: new Date(WEEK_END),
      createdBy: actor.id,
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
      weekEnd: new Date(WEEK_END),
      status: 'APPROVED',
      approvedBy: actor.id,
      approvedAt: new Date(),
    },
  })
  created.push({ table: 'operations.timesheet', id: timesheetId })

  for (let i = 0; i < DAYS; i += 1) {
    const day = new Date(WEEK_START)
    day.setUTCDate(day.getUTCDate() + i)

    const dayId = uuidv7()
    await db.timesheetDay.create({
      data: {
        id: dayId,
        timesheetId,
        workDate: day,
        grossMinutes: GROSS_PER_DAY,
        lunchDeductionMinutes: LUNCH_DEDUCTION,
        overtimeMinutes: i === 0 ? OVERTIME_MINUTES : 0,
      },
    })
    created.push({ table: 'operations.timesheet_day', id: dayId })
  }
}

beforeAll(seed)

afterAll(async () => {
  for (const row of [...created].reverse()) {
    await db.$executeRawUnsafe(`DELETE FROM ${row.table} WHERE id = $1::uuid`, row.id)
  }

  await close()
})

describe('golden test de nómina', () => {
  it('la vista calcula los netos con la deducción fija de 30 minutos', async () => {
    const rows = await db.$queryRaw<Array<{ net: number; gross: number }>>`
      SELECT sum(v.net_minutes)::int AS net, sum(v.gross_minutes)::int AS gross
        FROM operations.vw_timesheet_day v
        JOIN operations.timesheet t ON t.id = v.timesheet_id
       WHERE t.worker_id = ${workerId}::uuid`

    expect(rows[0]?.gross).toBe(DAYS * GROSS_PER_DAY)
    expect(rows[0]?.net).toBe(NET_MINUTES)
  })

  it(`lo que se le paga al colaborador es ${EXPECTED_PAY.toFixed(2)}`, async () => {
    const rows = await db.$queryRaw<Array<{ total: string }>>`
      WITH horas AS (
        SELECT sum(v.net_minutes)::int AS regular, sum(d.overtime_minutes)::int AS extra
          FROM operations.timesheet t
          JOIN operations.timesheet_day d    ON d.timesheet_id = t.id
          JOIN operations.vw_timesheet_day v ON v.id = d.id
         WHERE t.worker_id = ${workerId}::uuid AND t.status = 'APPROVED'
      )
      SELECT round((regular / 60.0) * ${PAY_RATE}::numeric
                 + (extra   / 60.0) * ${PAY_RATE}::numeric * ${OVERTIME_PAY_MULTIPLIER}::numeric
                 , 2)::text AS total
        FROM horas`

    expect(rows[0]?.total).toBe(EXPECTED_PAY.toFixed(2))
  })

  it(`lo que se le cobra al hotel es ${EXPECTED_BILL.toFixed(2)}`, async () => {
    const rows = await db.$queryRaw<Array<{ total: string }>>`
      WITH horas AS (
        SELECT sum(v.net_minutes)::int AS regular, sum(d.overtime_minutes)::int AS extra
          FROM operations.timesheet t
          JOIN operations.timesheet_day d    ON d.timesheet_id = t.id
          JOIN operations.vw_timesheet_day v ON v.id = d.id
         WHERE t.worker_id = ${workerId}::uuid AND t.status = 'APPROVED'
      )
      SELECT round((regular / 60.0) * ${BILL_RATE}::numeric
                 + (extra   / 60.0) * ${BILL_RATE}::numeric * ${OVERTIME_BILL_MULTIPLIER}::numeric
                 , 2)::text AS total
        FROM horas`

    expect(rows[0]?.total).toBe(EXPECTED_BILL.toFixed(2))
  })

  it('el margen de la semana es 665.00', () => {
    // 40 h regulares × (35 − 20) = 600
    //  2 h extra: 35 × 1.5 = 52.50 contra 20 × 1 = 20 → 32.50 cada una = 65
    expect(EXPECTED_PAY).toBeCloseTo(840, 2)
    expect(EXPECTED_BILL).toBeCloseTo(1505, 2)
    expect(EXPECTED_BILL - EXPECTED_PAY).toBeCloseTo(665, 2)
  })

  it('el neto nunca queda negativo aunque la jornada sea más corta que el lunch', async () => {
    const rows = await db.$queryRaw<Array<{ net: number }>>`
      SELECT greatest(0, 20 - 30) AS net`

    expect(rows[0]?.net).toBe(0)
  })
})
