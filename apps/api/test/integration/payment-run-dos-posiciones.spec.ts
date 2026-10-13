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
  makePosition,
  makeRequisition,
  makeSchedule,
  makeTimesheet,
  makeWorker,
  type Registry,
} from './payment-fixture.js'

/**
 * Regresión: una requisición con DOS posiciones no paga sus horas dos veces.
 *
 * El generador anterior (POST /consolidations/generate) unía la hoja con todas
 * las posiciones de la requisición antes de agrupar. Con dos posiciones de
 * catálogo distintas chocaba con ux_consolidation_detail_req (500); con la
 * misma posición de catálogo en dos líneas, sumaba cada hora dos veces en
 * silencio (300.00 en vez de 150.00). Aquí la hoja son 7.5 h netas a 20.00/h:
 * el pago debe ser 150.00 una sola vez, en los dos casos.
 */

const prisma = db as unknown as PrismaService
const WEEK = '2025-04-07'
const WEEK_END = '2025-04-13'
const RATE = 20
const EXPECTED = `${7.5 * RATE}.00`

const reg: Registry = { rows: [] }
const workers: string[] = []
let user: never

function service(): PaymentRunsService {
  const settings = new SettingsService(prisma)
  const limits = new PaymentLimitsService(prisma, settings)

  return new PaymentRunsService(new PaymentRunsRepository(prisma), limits, prisma)
}

interface Seeded {
  hotelId: string
  workerId: string
}

/**
 * Un hotel con una requisición de dos líneas y una hoja aprobada. Si
 * `samePosition` es true, las dos líneas son la misma posición de catálogo.
 */
async function seed(params: {
  label: string
  samePosition: boolean
  actorId: string
}): Promise<Seeded> {
  const base = await lookups()
  const [pos1, pos2] = await db.catalogPosition.findMany({ take: 2, select: { id: true } })
  if (!pos1 || (!params.samePosition && !pos2)) {
    throw new Error('Hacen falta dos posiciones de catálogo')
  }
  const secondPos = params.samePosition ? pos1 : pos2!

  const hotelId = await makeHotel(reg, {
    label: params.label,
    zoneId: base.zoneId,
    timeZone: 'America/Cancun',
  })
  await makeContract(reg, { hotelId, positionId: pos1.id, payRate: RATE, validFrom: '2025-01-01' })

  const requisitionId = await makeRequisition(reg, {
    hotelId,
    positionId: pos1.id,
    modalityId: base.modalityId,
    departmentId: base.departmentId,
    coverageStateId: base.coverageStateId,
    reqStateId: base.reqStateId,
    startDate: WEEK,
  })
  await makePosition(reg, {
    requisitionId,
    catalogPositionId: secondPos.id,
    lineNumber: 2,
    modalityId: base.modalityId,
    departmentId: base.departmentId,
    coverageStateId: base.coverageStateId,
    startDate: WEEK,
  })

  const workerId = await makeWorker(reg, {
    zoneId: base.zoneId,
    workerStateId: base.workerStateId,
    actorId: params.actorId,
    label: params.label,
  })
  workers.push(workerId)

  const scheduleId = await makeSchedule(reg, {
    hotelId,
    weekStart: WEEK,
    weekEnd: WEEK_END,
    actorId: params.actorId,
  })
  await makeTimesheet(reg, {
    scheduleId,
    weekStart: WEEK,
    weekEnd: WEEK_END,
    workerId,
    requisitionId,
    status: 'APPROVED',
    approvedAt: new Date('2025-04-15T18:00:00Z'),
    actorId: params.actorId,
  })

  return { hotelId, workerId }
}

describeIfMigrated('pago de una requisición con varias posiciones: una vez por hora', () => {
  let distinct: Seeded
  let same: Seeded

  beforeAll(async () => {
    const actorId = (await actor()).id
    user = { id: actorId, roleCode: 'ROL-SYS-01' } as never

    distinct = await seed({ label: 'DosPosDistintas', samePosition: false, actorId })
    same = await seed({ label: 'DosPosIguales', samePosition: true, actorId })
  })

  afterAll(async () => {
    await cleanup(reg, workers)
    await close()
  })

  it.each([
    ['dos posiciones de catálogo distintas', () => distinct],
    ['dos líneas con la misma posición de catálogo', () => same],
  ])('%s: el pago es 150.00 una sola vez', async (_label, pick) => {
    const { hotelId, workerId } = pick()

    const result = await service().run(
      { weekStart: WEEK, slot: 'WEDNESDAY_CUT', hotelId },
      user,
      new Date('2025-04-17T00:00:00Z'),
    )

    expect(result.hotels.find((h) => h.hotelId === hotelId)).toMatchObject({
      status: 'RAN',
      created: 1,
    })

    const rows = await db.$queryRaw<Array<{ gross: string; minutes: number; lines: bigint }>>`
      SELECT c.gross_amount::text AS gross,
             COALESCE(sum(d.regular_minutes + d.overtime_minutes), 0)::int AS minutes,
             count(d.id) AS lines
        FROM settlement.consolidation c
        LEFT JOIN settlement.consolidation_detail d ON d.consolidation_id = c.id
       WHERE c.worker_id = ${workerId}::uuid AND c.hotel_id = ${hotelId}::uuid
       GROUP BY c.id`

    expect(rows).toHaveLength(1)
    expect(rows[0]?.gross).toBe(EXPECTED)
    expect(rows[0]?.minutes).toBe(450)
    expect(Number(rows[0]?.lines)).toBe(1)
  })
})
