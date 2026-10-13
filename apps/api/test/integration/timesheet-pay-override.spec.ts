import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'
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
 * La corrección de Contabilidad sobre la vista previa (Hugo, 2026-10-08):
 * tarifa y reparto de horas, los dos editables, y lo que corrige se USA en la
 * corrida real — no es solo cosmético en la pantalla.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma), notifications)

const WEEK = '2025-06-02'
const WEEK_END = '2025-06-08'
const CONTRACT_RATE = 20

const reg: Registry = { rows: [] }
const workers: string[] = []
let actorId: string
function user(): AuthenticatedUser {
  return { id: actorId, roleCode: 'ROL-CO-01', hotelId: null, departmentId: null }
}

beforeAll(async () => {
  actorId = (await actor()).id
})

afterAll(async () => {
  await cleanup(reg, workers)
  await close()
})

describeIfMigrated('corrección de Contabilidad: tarifa y reparto de horas', () => {
  it('la vista previa refleja la corrección, y se puede borrar para volver a lo calculado', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'Override',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    await makeContract(reg, {
      hotelId,
      positionId: base.positionId,
      payRate: CONTRACT_RATE,
      validFrom: '2025-01-01',
      overtimePayMultiplier: 1.5,
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: WEEK,
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'Override',
    })
    workers.push(workerId)
    const scheduleId = await makeSchedule(reg, {
      hotelId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      actorId,
    })
    const timesheetId = await makeTimesheet(reg, {
      scheduleId,
      workerId,
      requisitionId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      status: 'OPEN',
      actorId,
    })

    // Sin corrección: 7.5 h a 20.00 = 150.00.
    const before = (await timesheets.list(user(), { weekStart: WEEK }, true)).find(
      (r) => r.id === timesheetId,
    )
    expect(before?.payPreview).toMatchObject({
      regularMinutes: 450,
      overtimeMinutes: 0,
      payRate: '20.00',
      subtotal: '150.00',
      isOverridden: false,
    })

    const corrected = await timesheets.setPayOverride(
      timesheetId,
      { regularMinutes: 400, overtimeMinutes: 50, payRate: 22, reason: 'corrección de prueba' },
      user(),
    )

    expect(corrected.payPreview).toMatchObject({
      regularMinutes: 400,
      overtimeMinutes: 50,
      payRate: '22.00',
      overtimeMultiplier: 1.5,
      subtotal: '174.17',
      isOverridden: true,
      overrideReason: 'corrección de prueba',
    })

    const reverted = await timesheets.clearPayOverride(timesheetId)

    expect(reverted.payPreview).toMatchObject({
      regularMinutes: 450,
      overtimeMinutes: 0,
      payRate: '20.00',
      subtotal: '150.00',
      isOverridden: false,
      overrideReason: null,
    })
  })

  it('la corrida real paga lo que Contabilidad corrigió, no lo calculado', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'OverrideRun',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    await makeContract(reg, {
      hotelId,
      positionId: base.positionId,
      payRate: CONTRACT_RATE,
      validFrom: '2025-01-01',
      overtimePayMultiplier: 1.5,
    })
    const requisitionId = await makeRequisition(reg, {
      hotelId,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: WEEK,
    })
    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'OverrideRun',
    })
    workers.push(workerId)
    const scheduleId = await makeSchedule(reg, {
      hotelId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      actorId,
    })
    const timesheetId = await makeTimesheet(reg, {
      scheduleId,
      workerId,
      requisitionId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      status: 'APPROVED',
      approvedAt: new Date('2025-06-04T18:00:00Z'),
      actorId,
    })

    await timesheets.setPayOverride(
      timesheetId,
      { regularMinutes: 400, overtimeMinutes: 50, payRate: 22, reason: 'corrección de prueba' },
      user(),
    )

    const settings = new SettingsService(prisma)
    const limits = new PaymentLimitsService(prisma, settings)
    const service = new PaymentRunsService(new PaymentRunsRepository(prisma), limits, prisma)
    // El corte del miércoles es el de la semana SIGUIENTE a la trabajada
    // (weekEnd + 3 días, ver `weekCalendar`): para la semana del 2 de junio,
    // el corte cae el 11 de junio.
    await service.run(
      { weekStart: WEEK, slot: 'WEDNESDAY_CUT', hotelId },
      { id: actorId, roleCode: 'ROL-SYS-01' } as AuthenticatedUser,
      new Date('2025-06-11T22:00:00Z'),
    )

    const [detail] = await db.$queryRaw<
      Array<{
        regularMinutes: number
        overtimeMinutes: number
        payRateApplied: string
        subtotal: string
      }>
    >`
      SELECT cd.regular_minutes     AS "regularMinutes",
             cd.overtime_minutes    AS "overtimeMinutes",
             cd.pay_rate_applied::text AS "payRateApplied",
             cd.subtotal::text      AS "subtotal"
        FROM settlement.consolidation_detail cd
        JOIN settlement.consolidation c ON c.id = cd.consolidation_id
       WHERE c.worker_id = ${workerId}::uuid AND c.hotel_id = ${hotelId}::uuid
         AND c.week_start = ${WEEK}::date AND c.run_kind = 'REGULAR'`

    expect(detail).toMatchObject({
      regularMinutes: 400,
      overtimeMinutes: 50,
      payRateApplied: '22.00',
      subtotal: '174.17',
    })
  })
})
