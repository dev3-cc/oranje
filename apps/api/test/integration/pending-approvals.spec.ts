import { v7 as uuidv7 } from 'uuid'

import { REQUIERE_PERMISO } from '../../src/common/decorators/requires.decorator.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'
import { NotificationPublisherService } from '../../src/modules/notifications/index.js'
import { ApprovalTimelinessRepository } from '../../src/modules/observability/approval-timeliness/approval-timeliness.repository.js'
import {
  ApprovalTimelinessService,
  levelOf,
  percentageOf,
} from '../../src/modules/observability/approval-timeliness/approval-timeliness.service.js'
import {
  HoursPendingAlertService,
  alertEntityId,
} from '../../src/modules/settlement/pending-approvals/hours-pending-alert.service.js'
import { PendingApprovalsController } from '../../src/modules/settlement/pending-approvals/pending-approvals.controller.js'
import { PendingApprovalsRepository } from '../../src/modules/settlement/pending-approvals/pending-approvals.repository.js'
import { PendingApprovalsService } from '../../src/modules/settlement/pending-approvals/pending-approvals.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Contabilidad ve las semanas con horas sin aprobar; el Manager de Área recibe
 * HOURS_PENDING al cierre; y el KPI 4 (aprobación oportuna de ponches) se
 * calcula en un solo lugar.
 *
 * El publicador es un STUB. Ninguna prueba de aquí llega a Pub/Sub, SMTP ni
 * Firebase: el servicio de avisos recibe solo `{ publish: jest.fn() }`.
 */

const prisma = db as unknown as PrismaService
const DAY_MS = 86_400_000
const CANCUN_MIDNIGHT_UTC_HOUR = 5 // Cancún es UTC-5 todo el año.

const created: Array<{ table: string; id: string }> = []

let actorId: string
let zoneId: string
let catalogPositionId: string
let hiringModalityId: string
let departmentId: string
let workerState: string
let reqState: string
let coverageState: string
let managerRoleId: string

interface Case {
  hotelId: string
  requisitionId: string
  departmentId: string
}

/** El lunes de hace `n` semanas, en UTC, a medianoche. La semana de prueba siempre está cerrada. */
function weekStartWeeksAgo(n: number): Date {
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(today - n * 7 * DAY_MS)
}

/** Cierre = inicio del día siguiente a `week_end`, en Cancún. */
function cutoffOf(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 7 * DAY_MS + CANCUN_MIDNIGHT_UTC_HOUR * 3_600_000)
}

const iso = (d: Date): string => d.toISOString().slice(0, 10)

async function hotelConRequisicion(label: string, manager: boolean): Promise<Case> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  const hotelId = uuidv7()
  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Aprobaciones ${label} ${stamp}`,
      zoneId,
      timeZone: 'America/Cancun',
    },
  })
  created.push({ table: 'commercial.hotel', id: hotelId })

  const requisitionId = uuidv7()
  await db.requisition.create({
    data: {
      id: requisitionId,
      number: `APR${stamp}`,
      hotelId,
      statusLightStateId: reqState,
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
      catalogPositionId,
      hiringModalityId,
      hotelDepartmentId: departmentId,
      quantity: 1,
      startDate: weekStartWeeksAgo(4),
      coverageStateId: coverageState,
      coverageLightCode: 'POSITION_COVERAGE',
    },
  })
  created.push({ table: 'demand."position"', id: positionId })

  if (manager) {
    const userId = uuidv7()
    await db.user.create({
      data: {
        id: userId,
        email: `manager-aprob-${stamp}@oranje.local`,
        fullName: `Manager de Área ${label}`,
        roleId: managerRoleId,
        hotelId,
        departmentId,
      },
    })
    created.push({ table: 'identity."user"', id: userId })
  }

  return { hotelId, requisitionId, departmentId }
}

/** Un timesheet de una semana cerrada, con `punches` ponches manuales en su único día. */
async function timesheet(params: {
  caso: Case
  weekStart: Date
  status: 'OPEN' | 'APPROVED' | 'PENDING_APPROVAL'
  approvedAt: Date | null
  punches: number
}): Promise<void> {
  const workerId = uuidv7()
  await db.worker.create({
    data: {
      id: workerId,
      fullName: `Aprobación ${uuidv7().slice(0, 8)}`,
      birthDate: new Date('1995-01-01'),
      gender: 'OTHER',
      phone: '9990000009',
      address: 'calle de prueba',
      zoneId,
      statusLightStateId: workerState,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
  })
  created.push({ table: 'personal.worker', id: workerId })

  const scheduleId = uuidv7()
  await db.schedule.create({
    data: {
      id: scheduleId,
      hotelId: params.caso.hotelId,
      weekStart: params.weekStart,
      weekEnd: new Date(params.weekStart.getTime() + 6 * DAY_MS),
      createdBy: actorId,
    },
  })
  created.push({ table: 'operations.schedule', id: scheduleId })

  const sheetId = uuidv7()
  await db.timesheet.create({
    data: {
      id: sheetId,
      scheduleId,
      workerId,
      requisitionId: params.caso.requisitionId,
      weekStart: params.weekStart,
      weekEnd: new Date(params.weekStart.getTime() + 6 * DAY_MS),
      status: params.status,
      approvedBy: params.status === 'APPROVED' ? actorId : null,
      approvedAt: params.approvedAt,
    },
  })
  created.push({ table: 'operations.timesheet', id: sheetId })

  const dayId = uuidv7()
  await db.timesheetDay.create({
    data: {
      id: dayId,
      timesheetId: sheetId,
      workDate: params.weekStart,
      grossMinutes: 480,
      lunchDeductionMinutes: 30,
      overtimeMinutes: 0,
    },
  })
  created.push({ table: 'operations.timesheet_day', id: dayId })

  // Una marca por tipo y día (ux de punch_mark): entrada y salida, en ese orden.
  const tipos = ['CLOCK_IN', 'CLOCK_OUT'] as const

  for (let i = 0; i < params.punches; i += 1) {
    const punchId = uuidv7()
    await db.punchMark.create({
      data: {
        id: punchId,
        timesheetDayId: dayId,
        type: tipos[i] ?? 'CLOCK_OUT',
        isManual: true,
        registeredBy: actorId,
        manualReason: 'prueba de integración',
      },
    })
    created.push({ table: 'operations.punch_mark', id: punchId })
  }
}

const publish = jest.fn((_event: unknown): Promise<void> => Promise.resolve())
const publisher = { publish } as unknown as NotificationPublisherService

const timeliness = new ApprovalTimelinessService(new ApprovalTimelinessRepository(prisma))
const pendientes = new PendingApprovalsService(new PendingApprovalsRepository(prisma))
const alertas = new HoursPendingAlertService(
  prisma,
  new PendingApprovalsRepository(prisma),
  publisher,
)

let aTiempo: Case
let tarde: Case
let pendiente: Case
let abierta: Case
let enCurso: Case
const SEMANA = weekStartWeeksAgo(3)

beforeAll(async () => {
  actorId = (await actor()).id
  zoneId = (await db.zone.findFirstOrThrow({ select: { id: true } })).id
  catalogPositionId = (await db.catalogPosition.findFirstOrThrow({ select: { id: true } })).id
  hiringModalityId = (await db.hiringModality.findFirstOrThrow({ select: { id: true } })).id
  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  managerRoleId = (
    await db.role.findFirstOrThrow({ where: { code: 'ROL-H-02' }, select: { id: true } })
  ).id
  workerState = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
      select: { id: true },
    })
  ).id
  reqState = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'LIGHT_BLUE', statusLightCode: 'REQUISITION' },
      select: { id: true },
    })
  ).id
  coverageState = (
    await db.statusLightState.findFirstOrThrow({
      where: { code: 'GREEN', statusLightCode: 'POSITION_COVERAGE' },
      select: { id: true },
    })
  ).id

  aTiempo = await hotelConRequisicion('a tiempo', true)
  tarde = await hotelConRequisicion('tarde', false)
  pendiente = await hotelConRequisicion('pendiente', false)
  abierta = await hotelConRequisicion('abierta', false)
  enCurso = await hotelConRequisicion('en curso', false)

  // Aprobado a tiempo: 1 día antes del cierre, dos ponches.
  await timesheet({
    caso: aTiempo,
    weekStart: SEMANA,
    status: 'APPROVED',
    approvedAt: new Date(cutoffOf(SEMANA).getTime() - DAY_MS),
    punches: 2,
  })
  // Aprobado tarde: 2 días después del cierre, un ponche.
  await timesheet({
    caso: tarde,
    weekStart: SEMANA,
    status: 'APPROVED',
    approvedAt: new Date(cutoffOf(SEMANA).getTime() + 2 * DAY_MS),
    punches: 1,
  })
  // Pendiente: enviado y nunca aprobado, un ponche.
  await timesheet({
    caso: pendiente,
    weekStart: SEMANA,
    status: 'PENDING_APPROVAL',
    approvedAt: null,
    punches: 1,
  })
})

afterAll(async () => {
  for (const row of [...created].reverse()) {
    await db.$executeRawUnsafe(`DELETE FROM ${row.table} WHERE id = $1::uuid`, row.id)
  }

  await close()
})

describe('KPI 4 · aprobación oportuna de ponches', () => {
  it('los umbrales del vault: verde ≥ 95, amarillo 85–94, rojo < 85', () => {
    expect(levelOf(100)).toBe('GREEN')
    expect(levelOf(95)).toBe('GREEN')
    expect(levelOf(94.9)).toBe('YELLOW')
    expect(levelOf(85)).toBe('YELLOW')
    expect(levelOf(84.9)).toBe('RED')
    expect(levelOf(null)).toBeNull()
    expect(percentageOf(2, 3)).toBe(66.7)
    expect(percentageOf(0, 0)).toBeNull()
  })

  it('aprobado a tiempo cuenta como a tiempo: 100 % y verde', async () => {
    const kpi = await timeliness.compute(8)
    const hotel = kpi.byHotel.find((h) => h.hotelId === aTiempo.hotelId)

    expect(hotel?.timesheets).toMatchObject({ total: 1, onTime: 1, late: 0, pending: 0 })
    expect(hotel?.punches).toMatchObject({ total: 2, onTime: 2, percentage: 100, level: 'GREEN' })
    expect(hotel?.avgDaysLate).toBeNull()
  })

  it('aprobado tarde cuenta como tarde: 0 % a tiempo, con días de atraso', async () => {
    const kpi = await timeliness.compute(8)
    const hotel = kpi.byHotel.find((h) => h.hotelId === tarde.hotelId)

    expect(hotel?.timesheets).toMatchObject({ total: 1, onTime: 0, late: 1, pending: 0 })
    expect(hotel?.punches).toMatchObject({ total: 1, onTime: 0, percentage: 0, level: 'RED' })
    expect(hotel?.avgDaysLate).toBe(2)
  })

  it('pendiente de aprobar cuenta como pendiente y sus días de atraso crecen hasta hoy', async () => {
    const kpi = await timeliness.compute(8)
    const hotel = kpi.byHotel.find((h) => h.hotelId === pendiente.hotelId)
    const diasHoy = Math.floor((Date.now() - cutoffOf(SEMANA).getTime()) / DAY_MS)

    expect(hotel?.timesheets).toMatchObject({ total: 1, onTime: 0, late: 0, pending: 1 })
    expect(hotel?.punches).toMatchObject({ total: 1, onTime: 0, percentage: 0, level: 'RED' })
    expect(hotel?.avgDaysLate).toBeGreaterThanOrEqual(diasHoy - 1)
  })

  it('el Manager de Área del departamento aparece con su hotel en el desglose por manager', async () => {
    const kpi = await timeliness.compute(8)
    const row = kpi.byManager.find((r) => r.hotelId === aTiempo.hotelId)

    expect(row?.departmentId).toBe(departmentId)
    expect(row?.managers.map((m) => m.fullName)).toEqual([`Manager de Área a tiempo`])
  })
})

describe('Contabilidad · semanas con horas sin aprobar', () => {
  it('lista solo la semana pendiente, con su responsable y los días de atraso', async () => {
    const rows = await pendientes.list({ hotelId: pendiente.hotelId })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      hotelId: pendiente.hotelId,
      weekStart: iso(SEMANA),
      pendingTimesheets: 1,
    })
    expect(rows[0]?.daysLate).toBeGreaterThanOrEqual(0)
    expect(rows[0]?.responsables[0]?.managers).toEqual([])
  })

  it('una semana ya aprobada no aparece', async () => {
    expect(await pendientes.list({ hotelId: aTiempo.hotelId })).toEqual([])
    expect(await pendientes.list({ hotelId: tarde.hotelId })).toEqual([])
  })

  it('el filtro de semana acota el resultado', async () => {
    expect(
      await pendientes.list({ hotelId: pendiente.hotelId, weekStart: iso(SEMANA) }),
    ).toHaveLength(1)
    expect(
      await pendientes.list({ hotelId: pendiente.hotelId, weekStart: iso(weekStartWeeksAgo(6)) }),
    ).toEqual([])
  })

  it('sin permiso de payroll:read no hay lectura (403 por el guard)', async () => {
    const permissions = new PermissionsService(prisma)

    // El decorador deja la metadata en la función del método, no en el prototipo.
    const listar: object = Reflect.get(PendingApprovalsController.prototype, 'list')

    expect(Reflect.getMetadata(REQUIERE_PERMISO, listar)).toEqual({
      module: 'payroll',
      action: 'read',
    })
    expect(await permissions.can('ROL-H-02', 'payroll', 'read')).toBe(false)
    expect(await permissions.can('ROL-H-01', 'payroll', 'read')).toBe(false)
    expect(await permissions.can('ROL-CO-01', 'payroll', 'read')).toBe(true)
  })
})

describe('HOURS_PENDING al cierre semanal', () => {
  beforeEach(() => {
    publish.mockClear()
  })

  it('avisa al Manager de Área del departamento, una sola vez por hotel y semana', async () => {
    const primera = await alertas.run({ hotelId: pendiente.hotelId, lookbackDays: 60 })

    expect(primera).toEqual({ weeks: 1, sent: 1, skipped: 0 })
    expect(publish).toHaveBeenCalledTimes(1)

    const event = publish.mock.calls[0]?.[0] as {
      type: string
      entity: { id: string }
      audience: Array<Record<string, unknown>>
    }
    expect(event.type).toBe('HOURS_PENDING')
    expect(event.entity.id).toBe(alertEntityId(pendiente.hotelId, iso(SEMANA)))
    expect(event.audience).toEqual([
      {
        kind: 'ROLE_IN_HOTEL_DEPARTMENT',
        roleCode: 'ROL-H-02',
        hotelId: pendiente.hotelId,
        departmentId,
      },
      { kind: 'ROLE_IN_HOTEL', roleCode: 'ROL-H-03', hotelId: pendiente.hotelId },
    ])
  })

  it('una segunda corrida no vuelve a mandar el mismo aviso', async () => {
    const segunda = await alertas.run({ hotelId: pendiente.hotelId, lookbackDays: 60 })

    expect(segunda).toEqual({ weeks: 1, sent: 0, skipped: 1 })
    expect(publish).not.toHaveBeenCalled()
  })

  it('una semana aprobada no genera aviso', async () => {
    const r = await alertas.run({ hotelId: aTiempo.hotelId, lookbackDays: 60 })

    expect(r).toEqual({ weeks: 0, sent: 0, skipped: 0 })
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('HOURS_PENDING y pendientes · semana OPEN', () => {
  let baseline: { percentage: number | null }

  beforeAll(async () => {
    // Base antes de agregar la semana OPEN, para medir cuánto baja el KPI global.
    const antes = await timeliness.compute(8)
    baseline = { percentage: antes.overall.punches.percentage }

    // Semana cerrada que nunca se envió: OPEN, un ponche, sin aprobación.
    await timesheet({
      caso: abierta,
      weekStart: SEMANA,
      status: 'OPEN',
      approvedAt: null,
      punches: 1,
    })
    // Semana en curso, también OPEN: todavía no cierra, no debe contar.
    await timesheet({
      caso: enCurso,
      weekStart: weekStartWeeksAgo(0),
      status: 'OPEN',
      approvedAt: null,
      punches: 1,
    })
  })

  beforeEach(() => {
    publish.mockClear()
  })

  it('una semana cerrada en OPEN aparece en la lista de pendientes', async () => {
    const rows = await pendientes.list({ hotelId: abierta.hotelId })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ weekStart: iso(SEMANA), pendingTimesheets: 1 })
  })

  it('una semana en curso en OPEN no aparece en la lista', async () => {
    expect(await pendientes.list({ hotelId: enCurso.hotelId })).toEqual([])
  })

  it('una semana cerrada en OPEN baja el porcentaje de la KPI, de hotel y global', async () => {
    const kpi = await timeliness.compute(8)
    const hotel = kpi.byHotel.find((h) => h.hotelId === abierta.hotelId)

    expect(hotel?.timesheets).toMatchObject({ total: 1, onTime: 0, late: 0, pending: 1 })
    expect(hotel?.punches).toMatchObject({ total: 1, onTime: 0, percentage: 0, level: 'RED' })

    expect(kpi.overall.punches.percentage).toBeLessThan(baseline.percentage ?? 100)
  })

  it('una semana en curso en OPEN no entra al KPI', async () => {
    const kpi = await timeliness.compute(8)

    expect(kpi.byHotel.find((h) => h.hotelId === enCurso.hotelId)).toBeUndefined()
  })

  it('dispara HOURS_PENDING a los dos roles y se avisa una sola vez', async () => {
    const primera = await alertas.run({ hotelId: abierta.hotelId, lookbackDays: 60 })

    expect(primera).toEqual({ weeks: 1, sent: 1, skipped: 0 })
    expect(publish).toHaveBeenCalledTimes(1)

    const event = publish.mock.calls[0]?.[0] as {
      type: string
      audience: Array<Record<string, unknown>>
    }
    expect(event.type).toBe('HOURS_PENDING')
    expect(event.audience.map((a) => a.roleCode)).toEqual(['ROL-H-02', 'ROL-H-03'])

    publish.mockClear()
    const segunda = await alertas.run({ hotelId: abierta.hotelId, lookbackDays: 60 })

    expect(segunda).toEqual({ weeks: 1, sent: 0, skipped: 1 })
    expect(publish).not.toHaveBeenCalled()
  })

  it('la semana en curso no dispara aviso', async () => {
    const r = await alertas.run({ hotelId: enCurso.hotelId, lookbackDays: 60 })

    expect(r).toEqual({ weeks: 0, sent: 0, skipped: 0 })
    expect(publish).not.toHaveBeenCalled()
  })
})
