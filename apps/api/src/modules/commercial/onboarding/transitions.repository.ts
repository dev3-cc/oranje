import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

const STATUS_LIGHT = 'ONBOARDING'
const CLIENT_STATE = 'ORANGE'

export interface AllowedTransition {
  id: string
  toStateId: string | null
  returnsToPrevious: boolean
  requiresReason: boolean
  requiresEvidence: boolean
  roleCode: string
  toState: { code: string; color: string; name: string; isBranch: boolean } | null
}

@Injectable()
export class TransitionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async stepsFrom(fromStateId: string): Promise<AllowedTransition[]> {
    const rows = await this.prisma.statusLightTransition.findMany({
      where: { fromStateId, statusLight: { code: STATUS_LIGHT } },
      select: {
        id: true,
        toStateId: true,
        returnsToPrevious: true,
        requiresReason: true,
        requiresEvidence: true,
        authorizedRole: { select: { code: true } },
        toState: { select: { code: true, color: true, name: true, isBranch: true } },
      },
    })

    return rows.map((f) => ({
      id: f.id,
      toStateId: f.toStateId,
      returnsToPrevious: f.returnsToPrevious,
      requiresReason: f.requiresReason,
      requiresEvidence: f.requiresEvidence,
      roleCode: f.authorizedRole.code,
      toState: f.toState,
    }))
  }

  async stateByCode(code: string): Promise<{ id: string; code: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: STATUS_LIGHT },
      select: { id: true, code: true },
    })
  }

  async reasonByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.statusChangeReason.findFirst({
      where: { code, statusLight: { code: STATUS_LIGHT } },
      select: { id: true },
    })
  }

  async previousState(prospectId: string): Promise<{ id: string; code: string } | null> {
    const rows = await this.prisma.prospectStateHistory.findMany({
      where: { prospectId },
      orderBy: { occurredAt: 'desc' },
      take: 2,
      select: { fromState: { select: { id: true, code: true } } },
    })

    return rows[0]?.fromState ?? null
  }

  async applyChange(params: {
    prospectId: string
    fromStateId: string
    toStateId: string
    toStateCode: string
    reasonId: string | null
    note: string | null
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.prospect.update({
        where: { id: params.prospectId },
        data: {
          onboardingStateId: params.toStateId,
          updatedBy: params.userId,
          ...(params.toStateCode === CLIENT_STATE ? {} : {}),
        },
      })

      if (params.toStateCode === CLIENT_STATE) {
        const p = await tx.prospect.findUniqueOrThrow({
          where: { id: params.prospectId },
          select: { hotelId: true, hotel: { select: { activatedAt: true } } },
        })

        if (p.hotel.activatedAt === null) {
          await tx.hotel.update({
            where: { id: p.hotelId },
            data: { activatedAt: new Date(), updatedBy: params.userId },
          })
        }
      }

      await tx.prospectStateHistory.create({
        data: {
          id: uuidv7(),
          prospectId: params.prospectId,
          fromStateId: params.fromStateId,
          toStateId: params.toStateId,
          statusLightCode: STATUS_LIGHT,
          reasonId: params.reasonId,
          userId: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.prospect',
          entityId: params.prospectId,
          eventType: 'STATUS_CHANGED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            to: params.toStateCode,
            reasonId: params.reasonId,
            note: params.note,
          },
        },
      })
    })
  }

  async historyOf(prospectId: string): Promise<
    Array<{
      id: string
      occurredAt: Date
      fromState: { code: string; name: string } | null
      toState: { code: string; name: string }
      reason: { code: string; name: string } | null
      user: { id: string; fullName: string }
    }>
  > {
    return this.prisma.prospectStateHistory.findMany({
      where: { prospectId },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        occurredAt: true,
        fromState: { select: { code: true, name: true } },
        toState: { select: { code: true, name: true } },
        reason: { select: { code: true, name: true } },
        user: { select: { id: true, fullName: true } },
      },
    })
  }
}
