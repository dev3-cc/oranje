import { v7 as uuidv7 } from 'uuid'

import type { AuthenticatedUser } from '../../src/common/decorators/index.js'
import type { PrismaService } from '../../src/infra/prisma/index.js'
import type { StorageService } from '../../src/infra/storage/index.js'
import { TeamService } from '../../src/modules/identity/team/team.service.js'
import type { StaffUsersService } from '../../src/modules/identity/users/staff-users.service.js'

import { close, db } from './db.js'

/**
 * Mi Equipo del Hotel (2026-10-21): el Manager General ve a los Managers de
 * Área y a los Supervisores activos de SU hotel; nada de otro hotel, nadie
 * dado de baja, y los Supervisores solo si tiene con qué verlos.
 */

const prisma = db as unknown as PrismaService
const storageStub = {
  signedUrl: (): Promise<null> => Promise.resolve(null),
} as unknown as StorageService
const team = new TeamService(prisma, storageStub, {} as StaffUsersService)

const stamp = Date.now()
const hotelId = uuidv7()
const otroHotelId = uuidv7()
const requisitionId = uuidv7()
const creados: string[] = []
let departmentId: string

async function persona(
  code: string,
  hotel: string,
  reportsToUserId: string | null,
  isActive = true,
  department: string | null = null,
): Promise<AuthenticatedUser> {
  const role = await db.role.findFirstOrThrow({ where: { code } })
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: `equipo-hotel-${uuidv7().slice(-12)}@oranje.local`,
      fullName: `Prueba ${code} ${stamp}`,
      roleId: role.id,
      hotelId: hotel,
      reportsToUserId,
      isActive,
      departmentId: department,
    },
    select: { id: true },
  })
  creados.push(user.id)
  return { id: user.id, roleCode: code, hotelId: hotel, departmentId: null }
}

let general: AuthenticatedUser
let gerente: AuthenticatedUser
let supervisor: AuthenticatedUser

beforeAll(async () => {
  const zone = await db.zone.findFirstOrThrow({ select: { id: true } })
  for (const [id, name] of [
    [hotelId, `Hotel Equipo ${stamp}`],
    [otroHotelId, `Otro Hotel ${stamp}`],
  ] as const) {
    await db.hotel.create({ data: { id, name, zoneId: zone.id, timeZone: 'America/Cancun' } })
  }

  departmentId = (await db.hotelDepartment.findFirstOrThrow({ select: { id: true } })).id
  general = await persona('ROL-H-03', hotelId, null)
  gerente = await persona('ROL-H-02', hotelId, general.id, true, departmentId)
  supervisor = await persona('ROL-H-01', hotelId, gerente.id)
  await persona('ROL-H-01', hotelId, gerente.id, false) // dado de baja: no cuenta
  await persona('ROL-H-02', otroHotelId, null) // de otro hotel: no cuenta

  // Una requisición que el Supervisor creó hoy: cuenta en «este mes».
  const borrador = await db.statusLightState.findFirstOrThrow({
    where: { code: 'APPLE_GREEN', statusLightCode: 'REQUISITION' },
    select: { id: true },
  })
  await db.requisition.create({
    data: {
      id: requisitionId,
      number: `EQHOTEL-${stamp}`,
      hotelId,
      statusLightStateId: borrador.id,
      statusLightCode: 'REQUISITION',
      createdBy: supervisor.id,
    },
  })
})

afterAll(async () => {
  await db.requisitionStateHistory.deleteMany({ where: { requisitionId } })
  await db.requisition.deleteMany({ where: { id: requisitionId } })
  // Primero quienes reportan a alguien, después sus jefes: la llave es RESTRICT.
  for (const id of [...creados].reverse()) {
    await db.user.deleteMany({ where: { id } })
  }
  await db.hotel.deleteMany({ where: { id: { in: [hotelId, otroHotelId] } } })
  await close()
})

describe('Mi Equipo del Hotel del Manager General', () => {
  it('ve a los Managers de Área y Supervisores activos de su hotel, con a quién reportan', async () => {
    const equipo = await team.hotelTeam(general, true)

    expect(equipo.map((m) => m.id).sort()).toEqual([gerente.id, supervisor.id].sort())
    expect(equipo.find((m) => m.id === supervisor.id)).toMatchObject({
      role: { code: 'ROL-H-01' },
      reportsTo: { id: gerente.id },
      requisitionsThisMonth: 1,
      supervisorsInCharge: null,
      activeWorkers: null,
    })
  })

  it('al gerente le cuenta sus supervisores activos y los colaboradores activos de su departamento', async () => {
    const equipo = await team.hotelTeam(general, true)

    expect(equipo.find((m) => m.id === gerente.id)).toMatchObject({
      department: { id: departmentId },
      supervisorsInCharge: 1, // el dado de baja no cuenta
      activeWorkers: 0,
      requisitionsThisMonth: null,
    })
  })

  it('sin permiso para ver Supervisores, solo ve a los Managers de Área', async () => {
    const equipo = await team.hotelTeam(general, false)

    expect(equipo.map((m) => m.id)).toEqual([gerente.id])
  })

  it('sin hotel no hay equipo que mostrar', async () => {
    expect(await team.hotelTeam({ ...general, hotelId: null }, true)).toEqual([])
  })
})
