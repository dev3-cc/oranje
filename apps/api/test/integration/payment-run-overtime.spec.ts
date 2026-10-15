import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { PaymentLimitsService } from '../../src/modules/settings/payment-limits.service.js'
import { PaymentRunsRepository } from '../../src/modules/settlement/payment-runs/payment-runs.repository.js'
import { PaymentRunsService } from '../../src/modules/settlement/payment-runs/payment-runs.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import {
  cleanup,
  describeIfMigrated,
  lookups,
  makeContract,
  makeHotel,
  makeRequisition,
  makeSchedule,
  makeTimesheet,
  makeWorker,
  type Registry,
} from './payment-fixture.js'

/**
 * El bug real que destapó Hugo desde una captura de pantalla: `horas` sumaba
 * TODO como regular porque `d.overtime_minutes` nunca se escribe (siempre 0).
 * 45 horas en una misma requisición y semana pagaban 45 × tarifa, sin partir
 * en 40 regulares + 5 extra. El corte real vive ahora en la consulta misma
 * (`WEEKLY_OVERTIME_THRESHOLD_MINUTES`), por requisición (D-10).
 *
 * Seis días de 8 h brutas − 30 min de comida = 7.5 h netas/día × 6 = 45 h.
 * Semana 2025-03-03 (lunes), hotel en Cancún, corte del miércoles ya pasado.
 */

const prisma = db as unknown as PrismaService
const WEEK = '2025-03-03'
const WEEK_END = '2025-03-09'
const PAY_RATE = 20
const REGULAR_HOURS = 40
const OVERTIME_HOURS = 5

const reg: Registry = { rows: [] }
const workers: string[] = []
const at = (iso: string): Date => new Date(iso)

let user: never

function service(): PaymentRunsService {
  const settings = new SettingsService(prisma)
  const limits = new PaymentLimitsService(prisma, settings)

  return new PaymentRunsService(new PaymentRunsRepository(prisma), limits, prisma)
}

async function consolidationOf(
  workerId: string,
  hotelId: string,
): Promise<{ gross: string; regularMinutes: number; overtimeMinutes: number } | null> {
  const rows = await db.$queryRaw<
    Array<{ gross: string; regularMinutes: number; overtimeMinutes: number }>
  >`
    SELECT c.gross_amount::text AS gross,
           cd.regular_minutes   AS "regularMinutes",
           cd.overtime_minutes  AS "overtimeMinutes"
      FROM settlement.consolidation c
      JOIN settlement.consolidation_detail cd ON cd.consolidation_id = c.id
     WHERE c.worker_id = ${workerId}::uuid AND c.hotel_id = ${hotelId}::uuid
       AND c.week_start = ${WEEK}::date AND c.run_kind = 'REGULAR'`

  return rows[0] ?? null
}

describeIfMigrated('el corte de 40 horas semanales por requisición (D-10)', () => {
  let actorId: string
  let positionId: string
  let modalityId: string
  let departmentId: string
  let coverageStateId: string
  let reqStateId: string
  let zoneId: string
  let workerStateId: string

  beforeAll(async () => {
    actorId = (await actor()).id
    user = { id: actorId, roleCode: 'ROL-SYS-01' } as never
    const base = await lookups()
    ;({ positionId, modalityId, departmentId, coverageStateId, reqStateId, zoneId, workerStateId } =
      base)
  })

  afterAll(async () => {
    await cleanup(reg, workers)
    await close()
  })

  it('tiempo y medio: 40 h regulares + 5 extra a 1.5× entran en el mismo consolidado', async () => {
    const hotelId = await makeHotel(reg, { label: 'OT15', zoneId, timeZone: 'America/Cancun' })
    await makeContract(reg, {
      hotelId,
      positionId,
      payRate: PAY_RATE,
      validFrom: '2025-01-01',
      overtimePayMultiplier: 1.5,
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId,
      modalityId,
      departmentId,
      coverageStateId,
      reqStateId,
      startDate: WEEK,
    })
    const workerId = await makeWorker(reg, { zoneId, workerStateId, actorId, label: 'OT15' })
    workers.push(workerId)
    const scheduleId = await makeSchedule(reg, {
      hotelId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      actorId,
    })

    await makeTimesheet(reg, {
      scheduleId,
      workerId,
      requisitionId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      status: 'APPROVED',
      approvedAt: at('2025-03-12T18:00:00Z'),
      actorId,
      days: 6,
    })

    await service().run(
      { weekStart: WEEK, slot: 'WEDNESDAY_CUT', hotelId },
      user,
      at('2025-03-12T22:00:00Z'),
    )

    const row = await consolidationOf(workerId, hotelId)
    const expectedGross = REGULAR_HOURS * PAY_RATE + OVERTIME_HOURS * PAY_RATE * 1.5

    expect(row?.regularMinutes).toBe(REGULAR_HOURS * 60)
    expect(row?.overtimeMinutes).toBe(OVERTIME_HOURS * 60)
    expect(row?.gross).toBe(`${expectedGross.toFixed(2)}`)
  })

  it('"no paga horas extra" (multiplicador 0): las 5 horas de más no se pagan', async () => {
    const hotelId = await makeHotel(reg, { label: 'OT0', zoneId, timeZone: 'America/Cancun' })
    await makeContract(reg, {
      hotelId,
      positionId,
      payRate: PAY_RATE,
      validFrom: '2025-01-01',
      overtimePayMultiplier: 0,
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId,
      modalityId,
      departmentId,
      coverageStateId,
      reqStateId,
      startDate: WEEK,
    })
    const workerId = await makeWorker(reg, { zoneId, workerStateId, actorId, label: 'OT0' })
    workers.push(workerId)
    const scheduleId = await makeSchedule(reg, {
      hotelId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      actorId,
    })

    await makeTimesheet(reg, {
      scheduleId,
      workerId,
      requisitionId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      status: 'APPROVED',
      approvedAt: at('2025-03-12T18:00:00Z'),
      actorId,
      days: 6,
    })

    await service().run(
      { weekStart: WEEK, slot: 'WEDNESDAY_CUT', hotelId },
      user,
      at('2025-03-12T22:00:00Z'),
    )

    const row = await consolidationOf(workerId, hotelId)

    expect(row?.regularMinutes).toBe(REGULAR_HOURS * 60)
    expect(row?.overtimeMinutes).toBe(OVERTIME_HOURS * 60)
    expect(row?.gross).toBe(`${(REGULAR_HOURS * PAY_RATE).toFixed(2)}`)
  })
})
