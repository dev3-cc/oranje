import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/auth/permissions.service.js'

import { close, db } from './db.js'

/**
 * Quién levanta un veto de la Blacklist (Hugo, 2026-10-10).
 *
 * Era solo del Administrador. Se le planteó que, como Reclutamiento es quien
 * PONE el veto, dejar que la misma Reclutadora lo levante quita el segundo
 * par de ojos; con eso enfrente eligió los tres roles del departamento.
 *
 * Lo que fija esta prueba es que el PERMISO y la TRANSICIÓN del semáforo
 * digan lo mismo: si uno se mueve sin el otro, el botón aparece y el servidor
 * lo rechaza, o al revés.
 */
const prisma = db as unknown as PrismaService
const permissions = new PermissionsService(prisma)

const ESPERADOS = ['ROL-ADM-01', 'ROL-R-01', 'ROL-R-02', 'ROL-R-03']

afterAll(async () => {
  await close()
})

test('el permiso de levantar es del Administrador y de los tres de Reclutamiento', async () => {
  for (const rol of ESPERADOS) {
    expect(await permissions.can(rol, 'blacklist', 'lift')).toBe(true)
  }
  // El hotel no veta ni levanta: no es suyo.
  for (const ajeno of ['ROL-H-01', 'ROL-H-02', 'ROL-H-03', 'ROL-V-01']) {
    expect(await permissions.can(ajeno, 'blacklist', 'lift')).toBe(false)
  }
})

test('la transición Negro → Blanco está sembrada para los mismos cuatro', async () => {
  const rows = await db.$queryRaw<Array<{ code: string }>>`
    SELECT r.code
      FROM catalogs.status_light_transition t
      JOIN catalogs.status_light sl ON sl.id = t.status_light_id AND sl.code = 'WORKER'
      JOIN catalogs.status_light_state de ON de.id = t.from_state_id AND de.code = 'BLACK'
      JOIN catalogs.status_light_state ha ON ha.id = t.to_state_id AND ha.code = 'WHITE'
      JOIN identity.role r ON r.id = t.authorized_role_id
     ORDER BY r.code`

  expect(rows.map((r) => r.code)).toEqual(ESPERADOS)
})
