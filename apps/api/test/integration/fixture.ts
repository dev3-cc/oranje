import { v7 as uuidv7 } from 'uuid'

import { db } from './db.js'

/**
 * El actor de las pruebas.
 *
 * Los specs lo creaban con `db.user.findFirstOrThrow()`, o sea que dependían de
 * datos que alguien hubiera dejado a mano. En la instancia de desarrollo había
 * usuarios; en la base recién sembrada de CI, `identity.user` está vacía y las
 * tres suites morían en el `beforeAll`.
 *
 * Una prueba que necesita una fila la crea.
 */
export async function actor(): Promise<{ id: string }> {
  const email = 'tests@oranje.local'
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })

  if (existing) {
    return existing
  }

  const role = await db.role.findFirstOrThrow({
    where: { code: 'ROL-SYS-01' },
    select: { id: true },
  })

  return db.user.create({
    data: { id: uuidv7(), email, fullName: 'Pruebas de integración', roleId: role.id },
    select: { id: true },
  })
}

/**
 * Un contrato ACTIVO con tarifas, para que una requisición de prueba tenga
 * qué pedir (2026-10-17): `RequisitionsService.create` ya no acepta una
 * posición que el hotel no contrató, así que todo fixture que vaya a crear
 * una requisición necesita esto primero. Quien llama es responsable de
 * borrar `contractRate`/`contract` del hotel en su `afterAll` ANTES de
 * borrar el hotel — las dos FK son `onDelete: Restrict`.
 */
export async function contratoActivo(
  hotelId: string,
  catalogPositionIds: string[],
): Promise<string> {
  const contractId = uuidv7()

  await db.contract.create({
    data: {
      id: contractId,
      hotelId,
      number: `CT-PRUEBA-${contractId.slice(-12)}`,
      status: 'ACTIVE',
      validFrom: new Date('2026-01-01'),
      weekStartDay: 1,
      weekEndDay: 0,
    },
  })

  for (const catalogPositionId of catalogPositionIds) {
    await db.contractRate.create({
      data: { id: uuidv7(), contractId, catalogPositionId, payRate: '15.00', billRate: '20.00' },
    })
  }

  return contractId
}
