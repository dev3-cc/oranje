import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../infra/prisma/index.js'

import type { Audience } from './dto/event.dto.js'

// Convierte cada regla de audiencia en usuarios concretos. Es lo que el vault
// llama fan-out al escribir: guardar el ROL no sirve porque un hotel tiene
// varios Managers de Area —uno por departamento— y porque `read_at` es de una
// persona, no de un puesto.
@Injectable()
export class RecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(audience: Audience[]): Promise<string[]> {
    const ids = new Set<string>()

    for (const target of audience) {
      for (const id of await this.resolveOne(target)) {
        ids.add(id)
      }
    }

    return [...ids]
  }

  private async resolveOne(target: Audience): Promise<string[]> {
    switch (target.kind) {
      case 'USER':
        return this.activeUsers({ id: target.userId })

      case 'WORKER': {
        const worker = await this.prisma.worker.findUnique({
          where: { id: target.workerId },
          select: { userId: true },
        })

        // Un colaborador en Fase 1 todavia no tiene cuenta: no hay a quien
        // avisarle, y eso no es un error.
        return worker?.userId ? this.activeUsers({ id: worker.userId }) : []
      }

      case 'ROLE_IN_HOTEL':
        return this.activeUsers({ role: { code: target.roleCode }, hotelId: target.hotelId })

      case 'ROLE_IN_HOTEL_DEPARTMENT':
        // El departamento nulo significa "todos los del hotel", asi que el
        // Manager General entra tambien en el aviso de un departamento.
        return this.activeUsers({
          role: { code: target.roleCode },
          hotelId: target.hotelId,
          OR: [{ departmentId: target.departmentId }, { departmentId: null }],
        })

      case 'ROLE_IN_ZONE':
        return this.activeUsers({
          role: { code: target.roleCode },
          zones: { some: { zoneId: target.zoneId } },
        })

      case 'PROSPECT_OWNER': {
        const prospect = await this.prisma.prospect.findUnique({
          where: { id: target.prospectId },
          select: { ownerUserId: true },
        })

        return prospect ? this.activeUsers({ id: prospect.ownerUserId }) : []
      }

      case 'REQUISITION_RECRUITERS': {
        const rows = await this.prisma.participation.findMany({
          where: { requisitionId: target.requisitionId, leftAt: null },
          select: { userId: true },
        })

        return rows.length === 0 ? [] : this.activeUsers({ id: { in: rows.map((r) => r.userId) } })
      }

      case 'MANAGER_OF': {
        const user = await this.prisma.user.findUnique({
          where: { id: target.userId },
          select: { reportsToUserId: true },
        })

        return user?.reportsToUserId ? this.activeUsers({ id: user.reportsToUserId }) : []
      }
    }
  }

  // Una sola puerta: nadie inactivo recibe avisos, se pida como se pida.
  private async activeUsers(where: Record<string, unknown>): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { ...where, isActive: true },
      select: { id: true },
    })

    return rows.map((r) => r.id)
  }
}
