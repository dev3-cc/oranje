import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../../infra/prisma/index.js'

const SELECT = {
  id: true,
  number: true,
  status: true,
  occurredAt: true,
  siteLocation: true,
  circumstances: true,
  witnesses: true,
  immediateCare: true,
  onSiteCapturedAt: true,
  isTransferred: true,
  medicalCenter: true,
  diagnosis: true,
  disabilityDays: true,
  medicalNotes: true,
  medicalDischargeDate: true,
  closedAt: true,
  createdAt: true,
  hotel: { select: { id: true, name: true } },
  worker: { select: { id: true, fullName: true } },
  reportedByUser: { select: { id: true, fullName: true } },
  inspector: { select: { id: true, fullName: true } },
  capturedByUser: { select: { id: true, fullName: true } },
  closedByUser: { select: { id: true, fullName: true } },
} as const

export type AccidentRow = Prisma.WorkAccidentGetPayload<{ select: typeof SELECT }>

@Injectable()
export class AccidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async numberTaken(number: string): Promise<boolean> {
    return (await this.prisma.workAccident.count({ where: { number } })) > 0
  }

  async findById(id: string): Promise<AccidentRow | null> {
    return this.prisma.workAccident.findUnique({ where: { id }, select: SELECT })
  }

  async findMany(where: Prisma.WorkAccidentWhereInput): Promise<AccidentRow[]> {
    return this.prisma.workAccident.findMany({
      where,
      select: SELECT,
      orderBy: { occurredAt: 'desc' },
      take: 200,
    })
  }

  async worker(
    id: string,
  ): Promise<{ id: string; fullName: string; statusLightStateId: string } | null> {
    return this.prisma.worker.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fullName: true, statusLightStateId: true },
    })
  }

  // Mientras dure la migracion de correo, la cuenta vieja tambien resuelve al
  // mismo colaborador (Worker.legacyUserId, D-XX).
  async workerOfUser(userId: string): Promise<{ id: string; statusLightStateId: string } | null> {
    return this.prisma.worker.findFirst({
      where: { OR: [{ userId }, { legacyUserId: userId }], deletedAt: null },
      select: { id: true, statusLightStateId: true },
    })
  }

  async hotelZone(hotelId: string): Promise<{ zoneId: string } | null> {
    return this.prisma.hotel.findUnique({ where: { id: hotelId }, select: { zoneId: true } })
  }

  // El Inspector sale de la zona del hotel (RR-13). Se congela al crear.
  async inspectorOfZone(zoneId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { isActive: true, role: { code: 'ROL-I-01' }, zones: { some: { zoneId } } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  // El Supervisor sale del hotel del accidente, mismo criterio que el Inspector.
  async supervisorOfHotel(hotelId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { isActive: true, role: { code: 'ROL-H-01' }, hotelId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async stateByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: 'WORKER' },
      select: { id: true },
    })
  }

  async transitionAllowed(
    fromStateId: string,
    toStateId: string,
    roleCode: string,
  ): Promise<boolean> {
    return (
      (await this.prisma.statusLightTransition.count({
        where: {
          fromStateId,
          toStateId,
          authorizedRole: { code: roleCode },
        },
      })) > 0
    )
  }

  // Unchecked: la tarjeta guarda cuatro papeles como columnas de FK y aqui se
  // escriben por id, no conectando relaciones.
  async update(id: string, data: Prisma.WorkAccidentUncheckedUpdateInput): Promise<AccidentRow> {
    return this.prisma.workAccident.update({ where: { id }, data, select: SELECT })
  }
}

export { SELECT }
