import type { PrismaService } from '../../src/infra/prisma/index.js'
import { PermissionsService } from '../../src/modules/identity/index.js'

import { close, db } from './db.js'

/**
 * Quién puede subir qué. `POST /files` no tiene permiso propio: cada destino
 * exige el par del módulo que lo consume, y varios aceptan más de uno porque al
 * mismo archivo llegan roles distintos por caminos distintos.
 *
 * Esta suite fija la tabla contra la Matriz sembrada: si alguien mueve un
 * permiso, aquí se ve antes que en la pantalla.
 */

const permissions = new PermissionsService(db as unknown as PrismaService)

const COLABORADOR = 'ROL-C-01'
const RECLUTADORA = 'ROL-R-01'
const SUPERVISOR = 'ROL-H-01'
const ADMIN = 'ROL-ADM-01'

// Los mismos pares que declara CONFIG en files.service.
const DESTINOS = {
  WORKER_PHOTO: [{ module: 'recruitment', action: 'update_worker' }],
  WORKER_DOCUMENT: [
    { module: 'recruitment', action: 'update_worker' },
    { module: 'worker', action: 'complete_signup' },
  ],
  PUNCH_PHOTO: [
    { module: 'timesheet', action: 'punch' },
    { module: 'timesheet', action: 'read_department' },
  ],
  USER_PHOTO: [{ module: 'users', action: 'manage' }],
} as const

async function puede(roleCode: string, destino: keyof typeof DESTINOS): Promise<boolean> {
  for (const { module, action } of DESTINOS[destino]) {
    if (await permissions.can(roleCode, module, action)) {
      return true
    }
  }

  return false
}

afterAll(async () => {
  await close()
})

describe('quién sube qué', () => {
  it('el Colaborador sube su foto de ponche y su documento fiscal', async () => {
    expect(await puede(COLABORADOR, 'PUNCH_PHOTO')).toBe(true)
    expect(await puede(COLABORADOR, 'WORKER_DOCUMENT')).toBe(true)
  })

  // La foto del Pool la captura la Reclutadora en la entrevista (Fase 1), y el
  // personal del sistema no es asunto suyo.
  it('el Colaborador NO sube la foto del Pool ni la del personal', async () => {
    expect(await puede(COLABORADOR, 'WORKER_PHOTO')).toBe(false)
    expect(await puede(COLABORADOR, 'USER_PHOTO')).toBe(false)
  })

  it('la Reclutadora conserva lo suyo y no gana el ponche', async () => {
    expect(await puede(RECLUTADORA, 'WORKER_PHOTO')).toBe(true)
    expect(await puede(RECLUTADORA, 'WORKER_DOCUMENT')).toBe(true)
    expect(await puede(RECLUTADORA, 'PUNCH_PHOTO')).toBe(false)
    expect(await puede(RECLUTADORA, 'USER_PHOTO')).toBe(false)
  })

  it('el Supervisor llega a la foto del ponche por revisar, no por ponchar', async () => {
    expect(await permissions.can(SUPERVISOR, 'timesheet', 'punch')).toBe(false)
    expect(await puede(SUPERVISOR, 'PUNCH_PHOTO')).toBe(true)
  })

  it('solo el Administrador sube la foto del personal del sistema', async () => {
    expect(await puede(ADMIN, 'USER_PHOTO')).toBe(true)
    expect(await puede(SUPERVISOR, 'USER_PHOTO')).toBe(false)
  })
})
