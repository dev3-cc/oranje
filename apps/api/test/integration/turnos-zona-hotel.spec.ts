import { v7 as uuidv7 } from 'uuid'

import { close, db } from './db.js'

/**
 * El «07:00» que teclea el Supervisor es la hora DEL HOTEL, no UTC. Guardarla
 * como 07:00Z eran las 02:00 de la madrugada en Cancún: el Schedule del staff
 * lo tapaba porque pintaba la hora recortando el string UTC, y se vio cuando el
 * Colaborador la miró desde su teléfono.
 *
 * La conversión la hace Postgres con AT TIME ZONE, así que lo que se defiende
 * aquí es el SQL, no una función de JS.
 */

// -05:00 todo el año: Cancún no cambia horario, y por eso sirve de referencia.
const CANCUN = 'America/Cancun'
// -08:00 en invierno, -07:00 en verano: aquí sí importa la fecha.
const TIJUANA = 'America/Tijuana'

function rango(dia: string, hora: string, zona: string): Promise<Array<{ inicio: Date }>> {
  return db.$queryRaw<Array<{ inicio: Date }>>`
    SELECT lower(tstzrange(
             ${`${dia} ${hora}:00`}::timestamp AT TIME ZONE ${zona},
             ${`${dia} 23:00:00`}::timestamp AT TIME ZONE ${zona},
             '[)')) AS inicio`
}

afterAll(async () => {
  await close()
})

describe('la hora del turno se ancla en la zona del hotel', () => {
  it('07:00 en Cancún son las 12:00Z', async () => {
    const [row] = await rango('2026-08-31', '07:00', CANCUN)

    expect(row?.inicio.toISOString()).toBe('2026-08-31T12:00:00.000Z')
  })

  it('la misma hora en otra zona da otro instante', async () => {
    const [cancun] = await rango('2026-08-31', '07:00', CANCUN)
    const [tijuana] = await rango('2026-08-31', '07:00', TIJUANA)

    expect(cancun?.inicio.toISOString()).not.toBe(tijuana?.inicio.toISOString())
  })

  // Lo que ninguna conversión a mano acierta sin la base IANA.
  it('respeta el horario de verano donde lo hay', async () => {
    const [verano] = await rango('2026-07-15', '07:00', TIJUANA)
    const [invierno] = await rango('2026-01-15', '07:00', TIJUANA)

    expect(verano?.inicio.toISOString()).toBe('2026-07-15T14:00:00.000Z')
    expect(invierno?.inicio.toISOString()).toBe('2026-01-15T15:00:00.000Z')
  })

  it('un ponche a las 06:59 locales cae FUERA del turno de 07:00', async () => {
    const [row] = await db.$queryRaw<Array<{ dentro: boolean; justo: boolean }>>`
      SELECT
        tstzrange(
          '2026-08-31 07:00:00'::timestamp AT TIME ZONE ${CANCUN},
          '2026-08-31 15:00:00'::timestamp AT TIME ZONE ${CANCUN},
          '[)')
        @> ('2026-08-31 06:59:00'::timestamp AT TIME ZONE ${CANCUN}) AS dentro,
        tstzrange(
          '2026-08-31 07:00:00'::timestamp AT TIME ZONE ${CANCUN},
          '2026-08-31 15:00:00'::timestamp AT TIME ZONE ${CANCUN},
          '[)')
        @> ('2026-08-31 07:00:00'::timestamp AT TIME ZONE ${CANCUN}) AS justo`

    expect(row?.dentro).toBe(false)
    expect(row?.justo).toBe(true)
  })
})

describe('el turno guardado, de punta a punta', () => {
  const hotels: string[] = []

  afterAll(async () => {
    await db.hotel.deleteMany({ where: { id: { in: hotels } } })
  })

  it('un hotel en Cancún guarda su 07:00 como 12:00Z', async () => {
    const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
    const actor = await db.user.findFirstOrThrow({ select: { id: true } })
    const id = uuidv7()

    await db.hotel.create({
      data: {
        id,
        name: `Hotel Zona ${id.slice(-8)}`,
        zoneId: zone.id,
        timeZone: CANCUN,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    })

    hotels.push(id)

    const [row] = await db.$queryRaw<Array<{ inicio: Date }>>`
      SELECT lower(tstzrange(
               '2026-08-31 07:00:00'::timestamp AT TIME ZONE h.time_zone,
               '2026-08-31 15:00:00'::timestamp AT TIME ZONE h.time_zone,
               '[)')) AS inicio
        FROM commercial.hotel h WHERE h.id = ${id}::uuid`

    expect(row?.inicio.toISOString()).toBe('2026-08-31T12:00:00.000Z')
  })
})
