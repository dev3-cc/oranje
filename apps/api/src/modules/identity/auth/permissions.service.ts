import { Injectable, Logger } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

/**
 * Responde la primera de las dos preguntas de la autorización: **¿este rol puede
 * hacer esta acción, en principio?**
 *
 * La segunda —¿sobre qué filas?— es el alcance, vive en `identity.user`
 * (`hotel_id` + `department_id`) y la resuelve cada servicio con su consulta.
 * Este servicio no la toca: mezclarlas obligaría a una fila por hotel.
 *
 * Los permisos se cachean por rol. Son datos de catálogo que cambian con un
 * `INSERT` deliberado, no en cada request, y sin caché cada llamada pegaría a la
 * base solo para preguntar lo mismo. El costo es que revocar un permiso tarda
 * hasta `TTL_MS` en surtir efecto — por eso el TTL es corto y hay `invalidate()`.
 */
const TTL_MS = 60_000

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name)
  private readonly cache = new Map<string, { permisos: Set<string>; expira: number }>()

  constructor(private readonly prisma: PrismaService) {}

  async can(roleCode: string, module: string, action: string): Promise<boolean> {
    const permisos = await this.permisosDe(roleCode)

    return permisos.has(`${module}:${action}`)
  }

  /** Tras cambiar la Matriz. Sin argumento, tira todo. */
  invalidate(roleCode?: string): void {
    if (roleCode) {
      this.cache.delete(roleCode)
    } else {
      this.cache.clear()
    }
  }

  private async permisosDe(roleCode: string): Promise<Set<string>> {
    const enCache = this.cache.get(roleCode)

    if (enCache && enCache.expira > Date.now()) {
      return enCache.permisos
    }

    const filas = await this.prisma.rolePermission.findMany({
      where: { role: { code: roleCode } },
      select: { module: true, action: true },
    })

    const permisos = new Set(filas.map((f) => `${f.module}:${f.action}`))

    // Un rol sin filas no es un error: los departamentos sin matriz quedan
    // negados por omisión. Se avisa una vez por ciclo de caché, no en cada request
    if (permisos.size === 0) {
      this.logger.warn(`El rol ${roleCode} no tiene permisos: no podrá hacer nada`)
    }

    this.cache.set(roleCode, { permisos, expira: Date.now() + TTL_MS })

    return permisos
  }
}
