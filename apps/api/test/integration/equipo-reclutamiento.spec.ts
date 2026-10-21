import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { TeamService } from '../../src/modules/identity/team/team.service.js'
import type { StaffUsersService } from '../../src/modules/identity/users/staff-users.service.js'

import { close, db } from './db.js'

/**
 * Mi Equipo de la Manager de Reclutamiento (2026-10-21): ve dos niveles de su
 * jerarquía —sus Líderes y las Reclutadoras de cada una— y mueve Reclutadoras
 * solo dentro de su equipo. La actualización de personal (bitácora y aviso) es
 * un doble: aquí se prueba quién puede moverse a dónde, no el guardado.
 */

const prisma = db as unknown as PrismaService
const storageStub = {
  signedUrl: (): Promise<null> => Promise.resolve(null),
} as unknown as StorageService
const movimientos: Array<{ id: string; reportsToUserId: string | null | undefined }> = []
const staffUsersStub = {
  update: (id: string, dto: { reportsToUserId?: string | null }): Promise<object> => {
    movimientos.push({ id, reportsToUserId: dto.reportsToUserId })
    return Promise.resolve({})
  },
} as unknown as StaffUsersService

const team = new TeamService(prisma, storageStub, staffUsersStub)
const creados: string[] = []
const stamp = Date.now()
const hotelId = uuidv7()
const requisitionId = uuidv7()
const workerId = uuidv7()

async function persona(
  code: string,
  reportsToUserId: string | null,
  isActive = true,
): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `equipo-recl-${uuidv7().slice(-12)}@oranje.local`,
      fullName: `Prueba ${code}`,
      roleId: role.id,
      reportsToUserId,
      isActive,
    },
    select: { id: true },
  })
  creados.push(user.id)
  return { id: user.id, roleCode: code, hotelId: null, departmentId: null }
}

let manager: AuthenticatedUser
let lider: AuthenticatedUser
let deLaLider: AuthenticatedUser
let directa: AuthenticatedUser
let ajena: AuthenticatedUser
let liderAjena: AuthenticatedUser

beforeAll(async () => {
  manager = await persona('ROL-R-03', null)
  lider = await persona('ROL-R-02', manager.id)
  deLaLider = await persona('ROL-R-01', lider.id)
  directa = await persona('ROL-R-01', manager.id)
  await persona('ROL-R-01', manager.id, false) // inactiva: no cuenta

  const otraManager = await persona('ROL-R-03', null)
  liderAjena = await persona('ROL-R-02', otraManager.id)
  ajena = await persona('ROL-R-01', liderAjena.id)
})

afterAll(async () => {
  await db.participation.deleteMany({ where: { requisitionId } })
  await db.requisitionStateHistory.deleteMany({ where: { requisitionId } })
  await db.requisition.deleteMany({ where: { id: requisitionId } })
  await db.worker.deleteMany({ where: { id: workerId } })
  await db.hotel.deleteMany({ where: { id: hotelId } })
  // Primero quienes reportan a alguien, después sus jefes: la llave es RESTRICT.
  for (const id of [...creados].reverse()) {
    await db.user.deleteMany({ where: { id } })
  }
  await close()
})

describe('Mi Equipo de la Manager de Reclutamiento', () => {
  it('ve a sus Líderes y a las Reclutadoras de cada una, sin cuentas ajenas ni inactivas', async () => {
    const miembros = await team.recruitmentTeam(manager)
    const ids = miembros.map((m) => m.id).sort()

    expect(ids).toEqual([lider.id, deLaLider.id, directa.id].sort())
    expect(miembros.find((m) => m.id === deLaLider.id)?.reportsTo?.id).toBe(lider.id)
    expect(miembros.find((m) => m.id === directa.id)?.reportsTo?.id).toBe(manager.id)
  })

  it('sin actividad todavía, todo vale cero y no hay nada que listar', async () => {
    const [primera] = await team.recruitmentTeam(manager)

    expect(primera).toMatchObject({
      activeRequisitions: 0,
      coveredRequisitions: 0,
      assignmentsLast30Days: 0,
      workersCreatedLast30Days: 0,
      pendingValidation: 0,
      lastActivityAt: null,
      openRequisitions: [],
      pendingWorkers: [],
      recentWorkers: [],
    })
  })

  it('mueve a una Reclutadora con una Líder de su equipo o con ella misma', async () => {
    movimientos.length = 0
    await team.moveRecruiter(manager, directa.id, lider.id)
    await team.moveRecruiter(manager, deLaLider.id, manager.id)

    expect(movimientos).toEqual([
      { id: directa.id, reportsToUserId: lider.id },
      { id: deLaLider.id, reportsToUserId: manager.id },
    ])
  })

  it('no mueve a nadie de otro equipo, ni a una Líder, ni hacia una Líder ajena', async () => {
    await expect(team.moveRecruiter(manager, ajena.id, lider.id)).rejects.toMatchObject({
      response: { code: 'MEMBER_NOT_IN_TEAM' },
    })
    await expect(team.moveRecruiter(manager, lider.id, manager.id)).rejects.toMatchObject({
      response: { code: 'MEMBER_NOT_IN_TEAM' },
    })
    await expect(team.moveRecruiter(manager, directa.id, liderAjena.id)).rejects.toMatchObject({
      response: { code: 'INVALID_TEAM_LEAD' },
    })
  })

  it('lista sus requisiciones abiertas y sus altas en Blanco, para enlazar a cada una', async () => {
    const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
    const enProceso = await db.statusLightState.findFirstOrThrow({
      where: { code: 'YELLOW', statusLightCode: 'REQUISITION' },
      select: { id: true },
    })
    const blanco = await db.statusLightState.findFirstOrThrow({
      where: { code: 'WHITE', statusLightCode: 'WORKER' },
      select: { id: true },
    })
    await db.hotel.create({
      data: {
        id: hotelId,
        name: `Hotel Equipo ${stamp}`,
        zoneId: zone.id,
        timeZone: 'America/Cancun',
      },
    })
    await db.requisition.create({
      data: {
        id: requisitionId,
        number: `EQUIPO-${stamp}`,
        hotelId,
        statusLightStateId: enProceso.id,
        statusLightCode: 'REQUISITION',
      },
    })
    await db.participation.create({ data: { id: uuidv7(), requisitionId, userId: directa.id } })
    await db.worker.create({
      data: {
        id: workerId,
        fullName: `Alta en Blanco ${stamp}`,
        birthDate: new Date('1990-01-01'),
        gender: 'OTHER',
        phone: '9990000002',
        address: 'calle de prueba',
        zoneId: zone.id,
        statusLightStateId: blanco.id,
        statusLightCode: 'WORKER',
        createdBy: directa.id,
      },
    })

    const suya = (await team.recruitmentTeam(manager)).find((m) => m.id === directa.id)

    expect(suya).toMatchObject({
      activeRequisitions: 1,
      pendingValidation: 1,
      openRequisitions: [
        {
          id: requisitionId,
          number: `EQUIPO-${stamp}`,
          hotelName: `Hotel Equipo ${stamp}`,
          statusCode: 'YELLOW',
        },
      ],
      pendingWorkers: [{ id: workerId, fullName: `Alta en Blanco ${stamp}` }],
      workersCreatedLast30Days: 1,
      recentWorkers: [{ id: workerId, fullName: `Alta en Blanco ${stamp}`, statusCode: 'WHITE' }],
    })
  })
})
