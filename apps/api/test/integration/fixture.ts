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
