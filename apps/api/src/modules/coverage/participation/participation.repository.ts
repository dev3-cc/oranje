import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export const REQUISITION_LIGHT = 'REQUISITION'

export interface ParticipantRow {
  id: string
  joinedAt: Date
  user: { id: string; fullName: string; role: { code: string; name: string } }
}

@Injectable()
export class ParticipationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async requisition(id: string): Promise<{
    id: string
    number: string
    deletedAt: Date | null
    stateId: string
    stateCode: string
  } | null> {
    const row = await this.prisma.requisition.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        deletedAt: true,
        statusLightStateId: true,
        statusState: { select: { code: true } },
      },
    })

    return row
      ? {
          id: row.id,
          number: row.number,
          deletedAt: row.deletedAt,
          stateId: row.statusLightStateId,
          stateCode: row.statusState.code,
        }
      : null
  }

  async stateByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: REQUISITION_LIGHT },
      select: { id: true },
    })
  }

  async active(requisitionId: string): Promise<ParticipantRow[]> {
    return this.prisma.participation.findMany({
      where: { requisitionId, leftAt: null },
      orderBy: { joinedAt: 'asc' },
      select: {
        id: true,
        joinedAt: true,
        user: { select: { id: true, fullName: true, role: { select: { code: true, name: true } } } },
      },
    })
  }

  async mine(requisitionId: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.participation.findFirst({
      where: { requisitionId, userId, leftAt: null },
      select: { id: true },
    })
  }

  async join(params: {
    requisitionId: string
    userId: string
    roleCode: string
    toStateId: string | null
    fromStateId: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.participation.create({
        data: { id: uuidv7(), requisitionId: params.requisitionId, userId: params.userId },
      })

      if (params.toStateId) {
        await tx.requisition.update({
          where: { id: params.requisitionId },
          data: {
            statusLightStateId: params.toStateId,
            updatedAt: new Date(),
            updatedBy: params.userId,
          },
        })

        await tx.requisitionStateHistory.create({
          data: {
            id: uuidv7(),
            requisitionId: params.requisitionId,
            fromStateId: params.fromStateId,
            toStateId: params.toStateId,
            statusLightCode: REQUISITION_LIGHT,
            userId: params.userId,
          },
        })
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'demand.requisition',
          entityId: params.requisitionId,
          eventType: 'RECRUITER_JOINED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { movedToInProgress: params.toStateId !== null },
        },
      })
    })
  }

  async leave(params: {
    participationId: string
    requisitionId: string
    userId: string
    roleCode: string
    toStateId: string | null
    fromStateId: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.participation.update({
        where: { id: params.participationId },
        data: { leftAt: new Date() },
      })

      if (params.toStateId) {
        await tx.requisition.update({
          where: { id: params.requisitionId },
          data: {
            statusLightStateId: params.toStateId,
            updatedAt: new Date(),
            updatedBy: params.userId,
          },
        })

        await tx.requisitionStateHistory.create({
          data: {
            id: uuidv7(),
            requisitionId: params.requisitionId,
            fromStateId: params.fromStateId,
            toStateId: params.toStateId,
            statusLightCode: REQUISITION_LIGHT,
            userId: params.userId,
          },
        })
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'demand.requisition',
          entityId: params.requisitionId,
          eventType: 'RECRUITER_LEFT',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { returnedToQueue: params.toStateId !== null },
        },
      })
    })
  }
}
