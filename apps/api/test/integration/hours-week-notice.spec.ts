import { v7 as uuidv7 } from 'uuid'

import type { MailerService } from '../../src/infra/mailer/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { PaymentLimitsService } from '../../src/modules/settings/payment-limits.service.js'
import { HoursWeekNoticeRepository } from '../../src/modules/settlement/hours-week-notice/hours-week-notice.repository.js'
import { HoursWeekNoticeService } from '../../src/modules/settlement/hours-week-notice/hours-week-notice.service.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'
import {
  cleanup,
  lookups,
  makeHotel,
  makeRequisition,
  makeSchedule,
  makeTimesheet,
  makeWorker,
  type Registry,
} from './payment-fixture.js'

/**
 * El correo del sábado. El mailer es un STUB: ninguna prueba llega a SMTP ni a
 * Firebase. Se comprueba a quién iría, en qué idioma, con qué conteos, que
 * sale aunque no haya pendientes, que no sale antes de su hora y que no se
 * duplica al volver a correr.
 */

const prisma = db as unknown as PrismaService
const WEEK = '2025-03-03' // cerró el domingo 9 de marzo de 2025 (Cancún)
const SATURDAY_9AM_CANCUN = '2025-03-15T14:00:00Z' // sábado 15, 09:00 hora de Cancún
const reg: Registry = { rows: [] }
const workers: string[] = []

let mail: jest.Mock
let service: HoursWeekNoticeService

async function makeUser(params: {
  hotelId: string
  roleCode: string
  locale: string
  isActive?: boolean
  label: string
}): Promise<string> {
  const role = await db.role.findFirstOrThrow({
    where: { code: params.roleCode },
    select: { id: true },
  })
  const id = uuidv7()
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  await db.user.create({
    data: {
      id,
      email: `aviso-${params.label}-${stamp}@oranje.local`,
      fullName: `Aviso ${params.label}`,
      roleId: role.id,
      hotelId: params.hotelId,
      isActive: params.isActive ?? true,
      locale: params.locale,
    },
  })
  reg.rows.push({ table: 'identity."user"', id })

  return id
}

function notice(hotelId: string, now: string, weekStart?: string) {
  return service.run({ hotelId, weekStart }, null, new Date(now))
}

describe('correo del sábado: estado de las horas al Supervisor y al Manager de Área', () => {
  let hotelWithHours: string
  let hotelEmpty: string
  let hotelNoUsers: string

  beforeAll(async () => {
    const actorId = (await actor()).id
    const base = await lookups()

    hotelWithHours = await makeHotel(reg, {
      label: 'Aviso con horas',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    hotelEmpty = await makeHotel(reg, {
      label: 'Aviso sin horas',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    hotelNoUsers = await makeHotel(reg, {
      label: 'Aviso sin gente',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })

    // Supervisor en español, Manager de Área en inglés, y un Supervisor dado de baja que no debe salir.
    await makeUser({ hotelId: hotelWithHours, roleCode: 'ROL-H-01', locale: 'es', label: 'sup' })
    await makeUser({ hotelId: hotelWithHours, roleCode: 'ROL-H-02', locale: 'en', label: 'area' })
    await makeUser({
      hotelId: hotelWithHours,
      roleCode: 'ROL-H-01',
      locale: 'es',
      label: 'baja',
      isActive: false,
    })
    await makeUser({ hotelId: hotelEmpty, roleCode: 'ROL-H-02', locale: 'es', label: 'vacio' })

    const workerId = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'Aviso',
    })
    workers.push(workerId)

    const req = await makeRequisition(reg, {
      hotelId: hotelWithHours,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: WEEK,
    })
    const req2 = await makeRequisition(reg, {
      hotelId: hotelWithHours,
      positionId: base.positionId,
      modalityId: base.modalityId,
      departmentId: base.departmentId,
      coverageStateId: base.coverageStateId,
      reqStateId: base.reqStateId,
      startDate: WEEK,
    })
    const schedule = await makeSchedule(reg, {
      hotelId: hotelWithHours,
      weekStart: WEEK,
      weekEnd: '2025-03-09',
      actorId,
    })

    await makeTimesheet(reg, {
      scheduleId: schedule,
      workerId,
      requisitionId: req,
      weekStart: WEEK,
      weekEnd: '2025-03-09',
      status: 'APPROVED',
      approvedAt: new Date('2025-03-11T12:00:00Z'),
      actorId,
    })
    await makeTimesheet(reg, {
      scheduleId: schedule,
      workerId,
      requisitionId: req2,
      weekStart: WEEK,
      weekEnd: '2025-03-09',
      status: 'OPEN',
      actorId,
    })

    mail = jest.fn(() => ({ transport: 'SMTP', status: 'SENT', attempts: 1 }))
    const mailer = { send: mail } as unknown as MailerService
    const limits = new PaymentLimitsService(prisma, new SettingsService(prisma))

    service = new HoursWeekNoticeService(
      new HoursWeekNoticeRepository(prisma),
      limits,
      mailer,
      prisma,
    )
  })

  afterAll(async () => {
    await cleanup(reg, workers)
    await close()
  })

  it('sale el sábado a la hora configurada: antes, no sale nada', async () => {
    const result = await notice(hotelWithHours, '2025-03-15T13:00:00Z', WEEK)

    expect(result.hotels[0]).toMatchObject({ status: 'NOT_DUE', sent: 0 })
    expect(mail).not.toHaveBeenCalled()
  })

  it('manda al Supervisor y al Manager de Área activos, cada uno en su idioma, con los conteos de la semana', async () => {
    const result = await notice(hotelWithHours, SATURDAY_9AM_CANCUN, WEEK)

    expect(result.hotels[0]).toMatchObject({
      status: 'SENT',
      recipients: 2,
      sent: 2,
      approved: 1,
      pending: 1,
    })
    expect(mail).toHaveBeenCalledTimes(2)

    const sent = mail.mock.calls.map(
      (call: unknown[]) =>
        call[0] as { template: string; locale: string; data: Record<string, unknown> },
    )
    expect(sent.map((m) => m.template)).toEqual(['hours-week-status', 'hours-week-status'])
    expect(sent.map((m) => m.locale).sort()).toEqual(['en', 'es'])
    expect(sent[0]?.data).toMatchObject({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() tipa `any` en @types/jest
      hotelName: expect.any(String),
      weekStart: WEEK,
      weekEnd: '2025-03-09',
      approved: 1,
      pending: 1,
    })
  })

  it('volver a correr el sábado no vuelve a mandar', async () => {
    const result = await notice(hotelWithHours, SATURDAY_9AM_CANCUN, WEEK)

    expect(result.hotels[0]?.status).toBe('ALREADY_SENT')
    expect(mail).toHaveBeenCalledTimes(2)
  })

  it('sale siempre: un hotel sin una sola hoja de horas también recibe su correo, con ceros', async () => {
    const result = await notice(hotelEmpty, SATURDAY_9AM_CANCUN, WEEK)

    expect(result.hotels[0]).toMatchObject({
      status: 'SENT',
      recipients: 1,
      sent: 1,
      approved: 0,
      pending: 0,
    })
  })

  it('un hotel sin Supervisor ni Manager de Área activos no tiene a quién avisar, y lo dice', async () => {
    const result = await notice(hotelNoUsers, SATURDAY_9AM_CANCUN, WEEK)

    expect(result.hotels[0]?.status).toBe('NO_RECIPIENTS')
  })
})
