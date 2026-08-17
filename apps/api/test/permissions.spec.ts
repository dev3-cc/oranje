import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { REQUIERE_PERMISO } from '../src/common/decorators/index.js'
import type { PrismaService } from '../src/infra/prisma/index.js'
import { PermissionsGuard } from '../src/modules/identity/auth/guards/permissions.guard.js'
import { PermissionsService } from '../src/modules/identity/auth/permissions.service.js'

/** Prisma falso que cuenta cuántas veces se le preguntó. */
function prismaWith(rows: Array<{ module: string; action: string }>) {
  const calls = { n: 0 }
  const prisma = {
    rolePermission: {
      findMany: () => {
        calls.n += 1

        return Promise.resolve(rows)
      },
    },
  } as unknown as PrismaService

  return { prisma, calls }
}

function contextWith(user: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext
}

function reflectorWith(required: unknown): Reflector {
  return {
    getAllAndOverride: (key: string) => (key === REQUIERE_PERMISO ? required : undefined),
  } as unknown as Reflector
}

describe('PermissionsService', () => {
  const MATRIX = [
    { module: 'conversion', action: 'approve' },
    { module: 'pipeline', action: 'read' },
  ]

  it('deja pasar lo que la Matriz concede', async () => {
    const { prisma } = prismaWith(MATRIX)

    await expect(
      new PermissionsService(prisma).can('ROL-V-02', 'conversion', 'approve'),
    ).resolves.toBe(true)
  })

  it('niega lo que la Matriz no concede — RR-V-01: el BD no aprueba la conversión', async () => {
    const { prisma } = prismaWith([{ module: 'pipeline', action: 'read' }])

    await expect(
      new PermissionsService(prisma).can('ROL-V-01', 'conversion', 'approve'),
    ).resolves.toBe(false)
  })

  it('un rol sin permisos no puede nada: los departamentos sin matriz quedan negados', async () => {
    const { prisma } = prismaWith([])

    await expect(new PermissionsService(prisma).can('ROL-Q-01', 'pipeline', 'read')).resolves.toBe(
      false,
    )
  })

  it('cachea por rol: no pregunta a la base en cada request', async () => {
    const { prisma, calls } = prismaWith(MATRIX)
    const service = new PermissionsService(prisma)

    await service.can('ROL-V-02', 'pipeline', 'read')
    await service.can('ROL-V-02', 'conversion', 'approve')

    expect(calls.n).toBe(1)
  })

  it('invalidate obliga a releer, para que revocar surta efecto', async () => {
    const { prisma, calls } = prismaWith(MATRIX)
    const service = new PermissionsService(prisma)

    await service.can('ROL-V-02', 'pipeline', 'read')
    service.invalidate('ROL-V-02')
    await service.can('ROL-V-02', 'pipeline', 'read')

    expect(calls.n).toBe(2)
  })
})

describe('PermissionsGuard', () => {
  const user = { id: 'u1', roleCode: 'ROL-V-01', hotelId: null, departmentId: null }

  it('una ruta sin @Requires pasa', async () => {
    const { prisma } = prismaWith([])
    const guard = new PermissionsGuard(reflectorWith(undefined), new PermissionsService(prisma))

    await expect(guard.canActivate(contextWith(user))).resolves.toBe(true)
  })

  it('deja pasar cuando el rol tiene el permiso', async () => {
    const { prisma } = prismaWith([{ module: 'pipeline', action: 'create_prospect' }])
    const required = { module: 'pipeline', action: 'create_prospect' }
    const guard = new PermissionsGuard(reflectorWith(required), new PermissionsService(prisma))

    await expect(guard.canActivate(contextWith(user))).resolves.toBe(true)
  })

  it('responde 403 cuando no lo tiene', async () => {
    const { prisma } = prismaWith([{ module: 'pipeline', action: 'read' }])
    const required = { module: 'conversion', action: 'approve' }
    const guard = new PermissionsGuard(reflectorWith(required), new PermissionsService(prisma))

    await expect(guard.canActivate(contextWith(user))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('sin usuario también responde 403, no revienta', async () => {
    const { prisma } = prismaWith([])
    const required = { module: 'pipeline', action: 'read' }
    const guard = new PermissionsGuard(reflectorWith(required), new PermissionsService(prisma))

    await expect(guard.canActivate(contextWith(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })
})
