import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

const ESTADO_INICIAL = 'GRAY'
const SEMAFORO = 'ONBOARDING'

const SELECT = {
  id: true,
  needDescription: true,
  openedAt: true,
  closedAt: true,
  hotel: {
    select: { id: true, name: true, zone: { select: { id: true, code: true, name: true } } },
  },
  owner: { select: { id: true, fullName: true } },
  onboardingState: {
    select: { id: true, code: true, color: true, name: true, isBranch: true, displayOrder: true },
  },
  history: { select: { occurredAt: true }, orderBy: { occurredAt: 'desc' }, take: 1 },
  _count: { select: { attempts: true } },
} as const

export type ProspectRow = Prisma.ProspectGetPayload<{ select: typeof SELECT }>

export interface FiltroProspectos {
  page: number
  limit: number
  state?: string | undefined
  ownerUserId?: string | undefined
  zoneId?: string | undefined
  search?: string | undefined
  includeClosed: boolean
}

@Injectable()
export class ProspectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async estadoInicial(): Promise<{ id: string }> {
    return this.prisma.statusLightState.findFirstOrThrow({
      where: { code: ESTADO_INICIAL, statusLightCode: SEMAFORO },
      select: { id: true },
    })
  }

  async cicloAbiertoDe(hotelId: string): Promise<{ id: string } | null> {
    return this.prisma.prospect.findFirst({
      where: { hotelId, closedAt: null },
      select: { id: true },
    })
  }

  async hotelExists(hotelId: string): Promise<boolean> {
    return (await this.prisma.hotel.count({ where: { id: hotelId } })) > 0
  }

  async userExists(userId: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { id: userId, isActive: true } })) > 0
  }

  async create(
    hotelId: string,
    ownerUserId: string,
    needDescription: string | null,
    actorUserId: string,
  ): Promise<ProspectRow> {
    const estado = await this.estadoInicial()
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.prospect.create({
        data: {
          id,
          hotelId,
          ownerUserId,
          needDescription,
          onboardingStateId: estado.id,
          statusLightCode: SEMAFORO,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        },
      })

      await tx.prospectStateHistory.create({
        data: {
          id: uuidv7(),
          prospectId: id,
          fromStateId: null,
          toStateId: estado.id,
          statusLightCode: SEMAFORO,
          userId: actorUserId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.prospect',
          entityId: id,
          eventType: 'PROSPECT_OPENED',
          actorUserId,
          payload: { hotelId, ownerUserId, state: ESTADO_INICIAL },
        },
      })
    })

    return this.prisma.prospect.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async findMany(filtro: FiltroProspectos): Promise<{ rows: ProspectRow[]; total: number }> {
    const where: Prisma.ProspectWhereInput = {
      ...(filtro.includeClosed ? {} : { closedAt: null }),
      ...(filtro.state ? { onboardingState: { code: filtro.state } } : {}),
      ...(filtro.ownerUserId ? { ownerUserId: filtro.ownerUserId } : {}),
      ...(filtro.zoneId ? { hotel: { zoneId: filtro.zoneId } } : {}),
      ...(filtro.search
        ? { hotel: { name: { contains: filtro.search, mode: 'insensitive' } } }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.prospect.findMany({
        where,
        select: SELECT,
        orderBy: [{ onboardingState: { displayOrder: 'asc' } }, { openedAt: 'asc' }],
        skip: (filtro.page - 1) * filtro.limit,
        take: filtro.limit,
      }),
      this.prisma.prospect.count({ where }),
    ])

    return { rows, total }
  }

  async countByState(
    where: Prisma.ProspectWhereInput,
  ): Promise<Array<{ code: string; total: number }>> {
    const grupos = await this.prisma.prospect.groupBy({
      by: ['onboardingStateId'],
      where,
      _count: { _all: true },
    })

    const estados = await this.prisma.statusLightState.findMany({
      where: { statusLightCode: SEMAFORO },
      select: { id: true, code: true, displayOrder: true },
      orderBy: { displayOrder: 'asc' },
    })

    return estados.map((e) => ({
      code: e.code,
      total: grupos.find((g) => g.onboardingStateId === e.id)?._count._all ?? 0,
    }))
  }

  async findById(id: string): Promise<ProspectRow | null> {
    return this.prisma.prospect.findUnique({ where: { id }, select: SELECT })
  }
}
