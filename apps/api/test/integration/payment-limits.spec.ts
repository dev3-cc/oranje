import { BadRequestException } from '@nestjs/common'

import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { PaymentLimitsService } from '../../src/modules/settings/payment-limits.service.js'
import { DEFAULT_PAYMENT_LIMITS } from '../../src/modules/settlement/payment-calendar/payment-calendar.js'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Los límites de pago y aprobación viven en `catalogs.app_setting`: se leen
 * con valor por defecto, se cambian con journal y no aceptan un orden imposible
 * (aprobar después del corte). Al terminar se restauran los valores que había.
 */

const prisma = db as unknown as PrismaService
const KEYS = [
  'payment.approval_deadline',
  'payment.cut',
  'payment.emergency_send',
  'hours.saturday_notice',
] as const

const service = (): PaymentLimitsService =>
  new PaymentLimitsService(prisma, new SettingsService(prisma))

describe('límites configurables de pago y aprobación', () => {
  let actorUser: { id: string; roleCode: string }
  let previous: Array<{ key: string; value: string }>

  beforeAll(async () => {
    const user = await actor()
    actorUser = { id: user.id, roleCode: 'ROL-ADM-01' }
    previous = await db.appSetting.findMany({
      where: { key: { in: [...KEYS] } },
      select: { key: true, value: true },
    })
  })

  afterAll(async () => {
    await db.appSetting.deleteMany({ where: { key: { in: [...KEYS] } } })
    if (previous.length > 0) await db.appSetting.createMany({ data: previous })
    await close()
  })

  it('sin filas guardadas, responde los valores por defecto', async () => {
    await db.appSetting.deleteMany({ where: { key: { in: [...KEYS] } } })

    expect(await service().read()).toEqual(DEFAULT_PAYMENT_LIMITS)
  })

  it('cambiar un límite lo guarda, lo lee después y deja rastro en el journal', async () => {
    const limits = await service().update({ paymentCut: '17:30' }, actorUser as never)

    expect(limits.paymentCut).toBe('17:30')
    expect(limits.approvalDeadline).toBe(DEFAULT_PAYMENT_LIMITS.approvalDeadline)

    const entries = await db.journalEntry.findMany({
      where: {
        eventType: 'APP_SETTING_UPDATED',
        payload: { path: ['key'], equals: 'payment.cut' },
      },
      orderBy: { occurredAt: 'desc' },
      take: 1,
    })

    expect(entries[0]?.payload).toMatchObject({ key: 'payment.cut', to: '17:30' })
    expect(entries[0]?.actorUserId).toBe(actorUser.id)
  })

  it('no acepta un plazo de aprobación igual o posterior al corte del miércoles', async () => {
    await expect(
      service().update({ approvalDeadline: '17:30' }, actorUser as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('no acepta una hora que no es HH:mm', async () => {
    await expect(service().update({ saturdayNotice: '9am' }, actorUser as never)).rejects.toThrow()
  })

  it('un valor inválido guardado a mano cae al valor por defecto en vez de romper el cálculo', async () => {
    await db.appSetting.upsert({
      where: { key: 'hours.saturday_notice' },
      create: { key: 'hours.saturday_notice', value: 'mañana' },
      update: { value: 'mañana' },
    })

    expect((await service().read()).saturdayNotice).toBe(DEFAULT_PAYMENT_LIMITS.saturdayNotice)
  })
})
