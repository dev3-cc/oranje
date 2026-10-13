import type { PrismaService } from '../../src/infra/prisma/index.js'
import { SettingsService } from '../../src/infra/settings/index.js'
import { PaymentLimitsService } from '../../src/modules/settings/payment-limits.service.js'
import { PaymentRunsRepository } from '../../src/modules/settlement/payment-runs/payment-runs.repository.js'
import { PaymentRunsService } from '../../src/modules/settlement/payment-runs/payment-runs.service.js'

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
  describeIfMigrated,
  type Registry,
} from './payment-fixture.js'

/**
 * El pago en dos tiempos, sobre un hotel en Cancún (UTC-5, sin horario de
 * verano). La semana es de 2025 a propósito: nada más de la base la usa, y es
 * pasada, así que el corte ya llegó cuando la prueba lo dice.
 *
 *   Semana 2025-03-03 a 09-03. Miércoles 12: corte 16:00 hora de Cancún = 21:00 UTC.
 *   Jueves 13: envío 11:00 hora de Cancún = 16:00 UTC.
 *
 * Cada hoja son 7.5 h netas a 20.00/h = 150.00. El «ahora» se pasa a mano.
 */

const prisma = db as unknown as PrismaService
const WEEK = '2025-03-03'
const WEEK_END = '2025-03-09'
const PAY_RATE = 20
const LINE = 150

const reg: Registry = { rows: [] }
const workers: string[] = []
const at = (iso: string): Date => new Date(iso)

let user: never

function service(): PaymentRunsService {
  const settings = new SettingsService(prisma)
  const limits = new PaymentLimitsService(prisma, settings)

  return new PaymentRunsService(new PaymentRunsRepository(prisma), limits, prisma)
}

/** Bruto de un consolidado concreto: el del corte (REGULAR) o el de la emergencia (EMERGENCY). */
async function grossOf(
  workerId: string,
  hotelId: string,
  runKind: 'REGULAR' | 'EMERGENCY' = 'REGULAR',
): Promise<string | null> {
  const rows = await db.$queryRaw<Array<{ gross: string }>>`
    SELECT gross_amount::text AS gross FROM settlement.consolidation
     WHERE worker_id = ${workerId}::uuid AND hotel_id = ${hotelId}::uuid
       AND week_start = ${WEEK}::date AND run_kind = ${runKind}`

  return rows[0]?.gross ?? null
}

describeIfMigrated('pago en dos tiempos: miércoles (corte) y jueves (emergencia)', () => {
  let hotelId: string
  let workerA: string
  let workerB: string
  let actorId: string
  let positionId: string
  let scheduleId: string
  let modalityId: string
  let departmentId: string
  let coverageStateId: string
  let reqStateId: string

  beforeAll(async () => {
    actorId = (await actor()).id
    user = { id: actorId, roleCode: 'ROL-SYS-01' } as never
    const base = await lookups()
    positionId = base.positionId
    modalityId = base.modalityId
    departmentId = base.departmentId
    coverageStateId = base.coverageStateId
    reqStateId = base.reqStateId

    hotelId = await makeHotel(reg, {
      label: 'Pagos',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    await makeContract(reg, {
      hotelId,
      positionId: base.positionId,
      payRate: PAY_RATE,
      validFrom: '2025-01-01',
    })

    const req = () =>
      makeRequisition(reg, {
        hotelId,
        positionId: base.positionId,
        modalityId: base.modalityId,
        departmentId: base.departmentId,
        coverageStateId: base.coverageStateId,
        reqStateId: base.reqStateId,
        startDate: WEEK,
      })
    const req1 = await req()
    const req2 = await req()

    workerA = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'A',
    })
    workerB = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'B',
    })
    workers.push(workerA, workerB)

    const schedule = await makeSchedule(reg, {
      hotelId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      actorId,
    })
    scheduleId = schedule
    const common = { scheduleId: schedule, weekStart: WEEK, weekEnd: WEEK_END, actorId }

    // Antes del corte del miércoles (13:00 Cancún).
    await makeTimesheet(reg, {
      ...common,
      workerId: workerA,
      requisitionId: req1,
      status: 'APPROVED',
      approvedAt: at('2025-03-12T18:00:00Z'),
    })
    // Después del corte del miércoles (18:00 Cancún): tarde para el miércoles, a tiempo para el jueves.
    await makeTimesheet(reg, {
      ...common,
      workerId: workerA,
      requisitionId: req2,
      status: 'APPROVED',
      approvedAt: at('2025-03-12T23:00:00Z'),
    })
    await makeTimesheet(reg, {
      ...common,
      workerId: workerB,
      requisitionId: req1,
      status: 'APPROVED',
      approvedAt: at('2025-03-13T15:00:00Z'),
    })
    // Pendiente: nunca entra.
    await makeTimesheet(reg, { ...common, workerId: workerB, requisitionId: req2, status: 'OPEN' })
    /* La hoja de bloqueo se crea en su propio caso: si existiera ya, el envío
       del jueves la sumaría y la prueba de montos no diría nada. */
  })

  afterAll(async () => {
    await cleanup(reg, workers)
    await close()
  })

  it('antes del corte del miércoles no paga nada: el hotel sale NOT_DUE', async () => {
    const result = await service().run(
      { weekStart: WEEK, slot: 'WEDNESDAY_CUT', hotelId },
      user,
      at('2025-03-12T20:00:00Z'),
    )

    expect(result.hotels).toEqual([
      expect.objectContaining({ hotelId, status: 'NOT_DUE', created: 0 }),
    ])
    expect(await grossOf(workerA, hotelId)).toBeNull()
  })

  it('el corte del miércoles paga lo aprobado hasta las 16:00 de Cancún, y solo eso', async () => {
    const result = await service().run(
      { weekStart: WEEK, slot: 'WEDNESDAY_CUT', hotelId },
      user,
      at('2025-03-12T22:00:00Z'),
    )
    const ours = result.hotels.find((h) => h.hotelId === hotelId)

    expect(ours).toMatchObject({ status: 'RAN', created: 1, topped: 0, blocked: 0 })
    expect(ours?.runAt).toBe('2025-03-12T21:00:00.000Z')
    expect(await grossOf(workerA, hotelId)).toBe(`${LINE}.00`)
    expect(await grossOf(workerB, hotelId)).toBeNull()
  })

  it('el envío del jueves paga lo aprobado después del corte en su propio consolidado (EMERGENCY), sin tocar el del miércoles', async () => {
    const result = await service().run(
      { weekStart: WEEK, slot: 'THURSDAY_EMERGENCY', hotelId },
      user,
      at('2025-03-13T17:00:00Z'),
    )
    const ours = result.hotels.find((h) => h.hotelId === hotelId)

    // A y B tienen su consolidado de emergencia nuevo; el del miércoles de A no cambia.
    expect(ours).toMatchObject({ status: 'RAN', created: 2, topped: 0, blocked: 0 })
    expect(await grossOf(workerA, hotelId, 'EMERGENCY')).toBe(`${LINE}.00`)
    expect(await grossOf(workerB, hotelId, 'EMERGENCY')).toBe(`${LINE}.00`)
    expect(await grossOf(workerA, hotelId, 'REGULAR')).toBe(`${LINE}.00`)
    expect(await grossOf(workerB, hotelId, 'REGULAR')).toBeNull()
  })

  it('volver a correr el jueves no paga doble', async () => {
    const result = await service().run(
      { weekStart: WEEK, slot: 'THURSDAY_EMERGENCY', hotelId },
      user,
      at('2025-03-13T17:00:00Z'),
    )
    const ours = result.hotels.find((h) => h.hotelId === hotelId)

    expect(ours).toMatchObject({ status: 'RAN', created: 0, topped: 0, blocked: 0 })
    expect(await grossOf(workerA, hotelId, 'EMERGENCY')).toBe(`${LINE}.00`)
  })

  it('una hora aprobada tarde para un consolidado de emergencia ya validado se cuenta como bloqueada y no se pierde en silencio', async () => {
    const req3 = await makeRequisition(reg, {
      hotelId,
      positionId,
      modalityId,
      departmentId,
      coverageStateId,
      reqStateId,
      startDate: WEEK,
    })
    await makeTimesheet(reg, {
      scheduleId,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      workerId: workerA,
      requisitionId: req3,
      status: 'APPROVED',
      approvedAt: at('2025-03-13T14:00:00Z'),
      actorId,
    })

    await db.$executeRaw`
      UPDATE settlement.consolidation
         SET status = 'VALIDATED', validated_by = ${actorId}::uuid, validated_at = now()
       WHERE worker_id = ${workerA}::uuid AND hotel_id = ${hotelId}::uuid
         AND week_start = ${WEEK}::date AND run_kind = 'EMERGENCY'`

    const result = await service().run(
      { weekStart: WEEK, slot: 'THURSDAY_EMERGENCY', hotelId },
      user,
      at('2025-03-13T17:00:00Z'),
    )
    const ours = result.hotels.find((h) => h.hotelId === hotelId)

    expect(ours).toMatchObject({ status: 'RAN', created: 0, topped: 0, blocked: 1 })
    expect(await grossOf(workerA, hotelId, 'EMERGENCY')).toBe(`${LINE}.00`)
  })

  /**
   * PENDIENTE DE MIGRACIÓN (20261006T1000_consolidation_second_batch): el
   * jueves antes de las 11:00 se paga aunque el consolidado del miércoles ya
   * esté validado. Antes, esas horas caían en el consolidado validado y quedaban
   * bloqueadas; ahora van al consolidado de emergencia.
   */
  it('jueves antes de las 11:00: con el consolidado del miércoles ya validado, la emergencia lo paga y no queda bloqueado', async () => {
    const actorId = (await actor()).id
    const user2 = { id: actorId, roleCode: 'ROL-SYS-01' } as never
    const base = await lookups()

    const hotel = await makeHotel(reg, {
      label: 'Jueves',
      zoneId: base.zoneId,
      timeZone: 'America/Cancun',
    })
    await makeContract(reg, {
      hotelId: hotel,
      positionId: base.positionId,
      payRate: PAY_RATE,
      validFrom: '2025-01-01',
    })

    const req = () =>
      makeRequisition(reg, {
        hotelId: hotel,
        positionId: base.positionId,
        modalityId: base.modalityId,
        departmentId: base.departmentId,
        coverageStateId: base.coverageStateId,
        reqStateId: base.reqStateId,
        startDate: WEEK,
      })
    const worker = await makeWorker(reg, {
      zoneId: base.zoneId,
      workerStateId: base.workerStateId,
      actorId,
      label: 'Jueves',
    })
    workers.push(worker)
    const schedule = await makeSchedule(reg, {
      hotelId: hotel,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      actorId,
    })
    const common = {
      scheduleId: schedule,
      workerId: worker,
      weekStart: WEEK,
      weekEnd: WEEK_END,
      status: 'APPROVED' as const,
      actorId,
    }

    // Miércoles 13:00 Cancún: entra en el corte.
    await makeTimesheet(reg, {
      ...common,
      requisitionId: await req(),
      approvedAt: at('2025-03-12T18:00:00Z'),
    })
    await service().run(
      { weekStart: WEEK, slot: 'WEDNESDAY_CUT', hotelId: hotel },
      user2,
      at('2025-03-12T22:00:00Z'),
    )
    await db.$executeRaw`
      UPDATE settlement.consolidation
         SET status = 'VALIDATED', validated_by = ${actorId}::uuid, validated_at = now()
       WHERE worker_id = ${worker}::uuid AND hotel_id = ${hotel}::uuid
         AND week_start = ${WEEK}::date AND run_kind = 'REGULAR'`

    // Jueves 09:00 Cancún, antes del envío de las 11:00: después del corte, así que es emergencia.
    await makeTimesheet(reg, {
      ...common,
      requisitionId: await req(),
      approvedAt: at('2025-03-13T14:00:00Z'),
    })
    const result = await service().run(
      { weekStart: WEEK, slot: 'THURSDAY_EMERGENCY', hotelId: hotel },
      user2,
      at('2025-03-13T17:00:00Z'),
    )

    expect(result.hotels.find((h) => h.hotelId === hotel)).toMatchObject({
      status: 'RAN',
      created: 1,
      blocked: 0,
    })
    expect(await grossOf(worker, hotel, 'EMERGENCY')).toBe(`${LINE}.00`)
    expect(await grossOf(worker, hotel, 'REGULAR')).toBe(`${LINE}.00`)
  })
})
