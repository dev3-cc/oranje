import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { REQUIERE_PERMISO } from '../src/common/decorators/index.js'
import type { PrismaService } from '../src/infra/prisma/index.js'
import { PermissionsGuard } from '../src/modules/identity/auth/guards/permissions.guard.js'
import { PermissionsService } from '../src/modules/identity/auth/permissions.service.js'

/** Prisma falso que cuenta cuántas veces se le preguntó. */
function prismaCon(filas: Array<{ module: string; action: string }>) {
  const llamadas = { n: 0 }
  const prisma = {
    rolePermission: {
      findMany: () => {
        llamadas.n += 1

        return Promise.resolve(filas)
      },
    },
  } as unknown as PrismaService

  return { prisma, llamadas }
}

function contextoCon(user: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext
}

function reflectorCon(requerido: unknown): Reflector {
  return {
    getAllAndOverride: (clave: string) => (clave === REQUIERE_PERMISO ? requerido : undefined),
  } as unknown as Reflector
}

describe('PermissionsService', () => {
  const MATRIZ = [
    { module: 'conversion', action: 'approve' },
    { module: 'pipeline', action: 'read' },
  ]

  it('deja pasar lo que la Matriz concede', async () => {
    const { prisma } = prismaCon(MATRIZ)

    await expect(
      new PermissionsService(prisma).can('ROL-V-02', 'conversion', 'approve'),
    ).resolves.toBe(true)
  })

  it('niega lo que la Matriz no concede — RR-V-01: el BD no aprueba la conversión', async () => {
    const { prisma } = prismaCon([{ module: 'pipeline', action: 'read' }])

    await expect(
      new PermissionsService(prisma).can('ROL-V-01', 'conversion', 'approve'),
    ).resolves.toBe(false)
  })

  it('un rol sin permisos no puede nada: los departamentos sin matriz quedan negados', async () => {
    const { prisma } = prismaCon([])

    await expect(new PermissionsService(prisma).can('ROL-Q-01', 'pipeline', 'read')).resolves.toBe(
      false,
    )
  })

  it('cachea por rol: no pregunta a la base en cada request', async () => {
    const { prisma, llamadas } = prismaCon(MATRIZ)
    const service = new PermissionsService(prisma)

    await service.can('ROL-V-02', 'pipeline', 'read')
    await service.can('ROL-V-02', 'conversion', 'approve')

    expect(llamadas.n).toBe(1)
  })

  it('invalidate obliga a releer, para que revocar surta efecto', async () => {
    const { prisma, llamadas } = prismaCon(MATRIZ)
    const service = new PermissionsService(prisma)

    await service.can('ROL-V-02', 'pipeline', 'read')
    service.invalidate('ROL-V-02')
    await service.can('ROL-V-02', 'pipeline', 'read')

    expect(llamadas.n).toBe(2)
  })
})

describe('PermissionsGuard', () => {
  const usuario = { id: 'u1', roleCode: 'ROL-V-01', hotelId: null, departmentId: null }

  it('una ruta sin @Requires pasa', async () => {
    const { prisma } = prismaCon([])
    const guard = new PermissionsGuard(reflectorCon(undefined), new PermissionsService(prisma))

    await expect(guard.canActivate(contextoCon(usuario))).resolves.toBe(true)
  })

  it('deja pasar cuando el rol tiene el permiso', async () => {
    const { prisma } = prismaCon([{ module: 'pipeline', action: 'create_prospect' }])
    const requerido = { module: 'pipeline', action: 'create_prospect' }
    const guard = new PermissionsGuard(reflectorCon(requerido), new PermissionsService(prisma))

    await expect(guard.canActivate(contextoCon(usuario))).resolves.toBe(true)
  })

  it('responde 403 cuando no lo tiene', async () => {
    const { prisma } = prismaCon([{ module: 'pipeline', action: 'read' }])
    const requerido = { module: 'conversion', action: 'approve' }
    const guard = new PermissionsGuard(reflectorCon(requerido), new PermissionsService(prisma))

    await expect(guard.canActivate(contextoCon(usuario))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('sin usuario también responde 403, no revienta', async () => {
    const { prisma } = prismaCon([])
    const requerido = { module: 'pipeline', action: 'read' }
    const guard = new PermissionsGuard(reflectorCon(requerido), new PermissionsService(prisma))

    await expect(guard.canActivate(contextoCon(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })
})
