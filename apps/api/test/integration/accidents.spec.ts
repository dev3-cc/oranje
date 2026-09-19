import { v7 as uuidv7 } from 'uuid'

import { close, db } from './db.js'
import { actor } from './fixture.js'

/**
 * Lo que la tarjeta de accidente defiende: que no se cierre sin alta médica y
 * que el seguimiento sea coherente. Las dos son CHECK, o sea que valen aunque
 * el servicio se salte el paso.
 */

let actorId: string
let hotelId: string
let workerId: string
const cards: string[] = []

beforeAll(async () => {
  actorId = (await actor()).id

  const stamp = Date.now()
  const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
  const workerState = await db.statusLightState.findFirstOrThrow({
    where: { code: 'STRONG_GREEN', statusLightCode: 'WORKER' },
    select: { id: true },
  })

  hotelId = uuidv7()
  await db.hotel.create({
    data: {
      id: hotelId,
      name: `Hotel Accidentes ${stamp}`,
      zoneId: zone.id,
      timeZone: 'America/Cancun',
    },
  })

  workerId = uuidv7()
  await db.worker.create({
    data: {
      id: workerId,
      fullName: `Accidentado ${stamp}`,
      birthDate: new Date('1990-01-01'),
      gender: 'OTHER',
      phone: '9990000001',
      address: 'calle de prueba',
      zoneId: zone.id,
      statusLightStateId: workerState.id,
      statusLightCode: 'WORKER',
      createdBy: actorId,
    },
  })
})

afterAll(async () => {
  await db.workAccident.deleteMany({ where: { id: { in: cards } } })
  await db.worker.deleteMany({ where: { id: workerId } })
  await db.hotel.deleteMany({ where: { id: hotelId } })
  await close()
})

async function card(data: Record<string, unknown> = {}): Promise<string> {
  const id = uuidv7()

  await db.workAccident.create({
    data: {
      id,
      number: `T${Date.now()}${Math.floor(Math.random() * 100)}`,
      hotelId,
      workerId,
      reportedByUserId: actorId,
      occurredAt: new Date(),
      createdBy: actorId,
      ...data,
    },
  })

  cards.push(id)

  return id
}

describe('la tarjeta de accidente', () => {
  it('nace en REPORTED y con todo lo médico vacío', async () => {
    const row = await db.workAccident.findUniqueOrThrow({ where: { id: await card() } })

    expect(row.status).toBe('REPORTED')
    // NULO es "aún no se captura", que no es lo mismo que FALSE.
    expect(row.isTransferred).toBeNull()
    expect(row.closedAt).toBeNull()
  })

  it('rechaza un status que no existe', async () => {
    await expect(card({ status: 'EN_TRAMITE' })).rejects.toThrow(/ck_work_accident_status/)
  })

  it('no se cierra sin alta médica', async () => {
    const id = await card()

    await expect(
      db.workAccident.update({
        where: { id },
        data: { status: 'CLOSED', closedBy: actorId, closedAt: new Date() },
      }),
    ).rejects.toThrow(/ck_work_accident_close_requires_discharge/)
  })

  it('cierra cuando sí hay alta médica', async () => {
    const id = await card()

    const row = await db.workAccident.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedBy: actorId,
        closedAt: new Date(),
        medicalDischargeDate: new Date(),
      },
    })

    expect(row.status).toBe('CLOSED')
  })

  it('no acepta centro médico sin traslado', async () => {
    await expect(card({ isTransferred: false, medicalCenter: 'Clínica X' })).rejects.toThrow(
      /ck_work_accident_transfer_coherent/,
    )
  })

  it('sí lo acepta cuando hubo traslado', async () => {
    const id = await card({ isTransferred: true, medicalCenter: 'Clínica X' })

    expect(id).toBeTruthy()
  })

  it('no acepta media firma de captura presencial', async () => {
    await expect(card({ onSiteCapturedBy: actorId })).rejects.toThrow(
      /ck_work_accident_on_site_complete/,
    )
  })

  it('no acepta días de incapacidad negativos', async () => {
    await expect(card({ disabilityDays: -1 })).rejects.toThrow(/ck_work_accident_disability_days/)
  })

  it('no repite el número de reporte', async () => {
    const number = `T${uuidv7()}`

    await card({ number })
    await expect(card({ number })).rejects.toThrow(/Unique constraint|ux_work_accident_number/i)
  })
})
