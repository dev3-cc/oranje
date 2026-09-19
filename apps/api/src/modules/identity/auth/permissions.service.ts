import { Injectable, Logger } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

// La capacidad, no el alcance: sobre qué filas vive en identity.user y lo
// resuelve cada servicio. Mezclarlas obligaría a una fila por hotel.
//
// Se cachea por rol, así que revocar tarda hasta TTL_MS en surtir efecto.
const TTL_MS = 60_000

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name)
  private readonly cache = new Map<string, { permissions: Set<string>; expiresAt: number }>()

  constructor(private readonly prisma: PrismaService) {}

  async can(roleCode: string, module: string, action: string): Promise<boolean> {
    const permissions = await this.permissionsOf(roleCode)

    return permissions.has(`${module}:${action}`)
  }

  invalidate(roleCode?: string): void {
    if (roleCode) {
      this.cache.delete(roleCode)
    } else {
      this.cache.clear()
    }
  }

  private async permissionsOf(roleCode: string): Promise<Set<string>> {
    const cached = this.cache.get(roleCode)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { code: roleCode } },
      select: { module: true, action: true },
    })

    const permissions = new Set(rows.map((f) => `${f.module}:${f.action}`))

    // Un rol sin filas no es error: los departamentos sin matriz quedan negados.
    if (permissions.size === 0) {
      this.logger.warn(`El rol ${roleCode} no tiene permisos: no podrá hacer nada`)
    }

    this.cache.set(roleCode, { permissions, expiresAt: Date.now() + TTL_MS })

    return permissions
  }
}
