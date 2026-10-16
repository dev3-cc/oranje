import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { TimesheetsRepository } from '../../src/modules/operations/timesheets/timesheets.repository.js'
import { TimesheetsService } from '../../src/modules/operations/timesheets/timesheets.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import {
  cleanup,
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
 * La vista previa de pago del Timesheet (pedido de Hugo 2026-10-07): antes de
 * que corra el pago del miércoles, Contabilidad ve en la misma lista cuántas
 * horas son regulares, cuántas extra y cuánto se le pagaría — con el mismo
 * corte de 40 h y la misma cascada de tarifa que la corrida real.
 */

const prisma = db as unknown as PrismaService
const notifications = { publish: (): Promise<void> => Promise.resolve() } as never
const timesheets = new TimesheetsService(new TimesheetsRepository(prisma), notifications)

const WEEK = '2025-05-05'
const WEEK_END = '2025-05-11'
const PAY_RATE = 18

const reg: Registry = { rows: [] }
const workers: string[] = []
let actorId: string

beforeAll(async () => {
  actorId = (await actor()).id
})

afterAll(async () => {
  await cleanup(reg, workers)
  await close()
})

describe('vista previa de pago en el Timesheet de Contabilidad', () => {
  it('con rate resuelto: parte 40 h regulares y el resto a la tarifa del multiplicador del hotel', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'Preview',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    await makeContract(reg, {
      hotelId,
      positionId: base.positionId,
      payRate: PAY_RATE,
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
      label: 'Preview',
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
      days: 6, // 45 h netas: 40 regulares + 5 extra
    })

    const user = {
      id: actorId,
      roleCode: 'ROL-CO-01',
      hotelId: null,
      departmentId: null,
    } as AuthenticatedUser
    const rows = await timesheets.list(user, { weekStart: WEEK }, true)
    const row = rows.find((r) => r.id === timesheetId)

    expect(row?.payPreview).toMatchObject({
      regularMinutes: 40 * 60,
      overtimeMinutes: 5 * 60,
      payRate: `${PAY_RATE}.00`,
      overtimeMultiplier: 1.5,
      subtotal: `${(40 * PAY_RATE + 5 * PAY_RATE * 1.5).toFixed(2)}`,
    })
  })

  it('sin contrato ni tarifa interna: no inventa un pago, subtotal y tarifa van en null', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'SinTarifa',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
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
      label: 'SinTarifa',
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

    const user = {
      id: actorId,
      roleCode: 'ROL-CO-01',
      hotelId: null,
      departmentId: null,
    } as AuthenticatedUser
    const rows = await timesheets.list(user, { weekStart: WEEK }, true)
    const row = rows.find((r) => r.id === timesheetId)

    expect(row?.payPreview).toMatchObject({
      payRate: null,
      overtimeMultiplier: null,
      subtotal: null,
    })
  })

  it('sin el alcance de todos los hoteles, la fila no trae payPreview — es dato de sueldo', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'SoloHotel',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    await makeContract(reg, {
      hotelId,
      positionId: base.positionId,
      payRate: PAY_RATE,
      validFrom: '2025-01-01',
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
      label: 'SoloHotel',
    })
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
      status: 'OPEN',
      actorId,
    })

    const manager = {
      id: actorId,
      roleCode: 'ROL-H-03',
      hotelId,
      departmentId: null,
    } as AuthenticatedUser
    const rows = await timesheets.list(manager, { weekStart: WEEK }, false)

    expect(rows.every((r) => r.payPreview === undefined)).toBe(true)
  })

  // Hugo, 2026-10-16: con esto se avisa "el contrato cambió" cuando la
  // semana ya fue aprobada pero la tarifa se corrigió después.
  it('contractUpdatedAt viaja: null recién creado, se mueve al editar una tarifa', async () => {
    const base = await lookups()
    const hotelId = await makeHotel(reg, {
      label: 'ContractUpdated',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    await makeContract(reg, {
      hotelId,
      positionId: base.positionId,
      payRate: PAY_RATE,
      validFrom: '2025-01-01',
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
      label: 'ContractUpdated',
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

    const user = {
      id: actorId,
      roleCode: 'ROL-CO-01',
      hotelId: null,
      departmentId: null,
    } as AuthenticatedUser

    const before = await timesheets.list(user, { weekStart: WEEK }, true)
    expect(before.find((r) => r.id === timesheetId)?.payPreview?.contractUpdatedAt).toBeNull()

    const contractId = (
      await db.contract.findFirstOrThrow({ where: { hotelId }, select: { id: true } })
    ).id
    await db.$executeRaw`UPDATE commercial.contract SET updated_at = now() WHERE id = ${contractId}::uuid`

    const after = await timesheets.list(user, { weekStart: WEEK }, true)
    expect(after.find((r) => r.id === timesheetId)?.payPreview?.contractUpdatedAt).not.toBeNull()
  })
})
