import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

import { OUTCOMES } from './dto/create-contact-attempt.dto.js'

const SELECT = {
  id: true,
  attemptType: true,
  outcome: true,
  occurredAt: true,
  notes: true,
  hotelContact: { select: { id: true, fullName: true, jobTitle: true } },
  user: { select: { id: true, fullName: true } },
} as const

export type AttemptRow = {
  id: string
  attemptType: string
  outcome: string
  occurredAt: Date
  notes: string | null
  hotelContact: { id: string; fullName: string; jobTitle: string | null } | null
  user: { id: string; fullName: string }
}

@Injectable()
export class ContactAttemptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async prospect(
    id: string,
  ): Promise<{ id: string; hotelId: string; closedAt: Date | null } | null> {
    return this.prisma.prospect.findUnique({
      where: { id },
      select: { id: true, hotelId: true, closedAt: true },
    })
  }

  async contactOfHotel(
    contactId: string,
    hotelId: string,
  ): Promise<{ id: string; isActive: boolean } | null> {
    const row = await this.prisma.hotelContact.findUnique({
      where: { id: contactId },
      select: { id: true, hotelId: true, isActive: true },
    })

    return row?.hotelId === hotelId ? { id: row.id, isActive: row.isActive } : null
  }

  async create(params: {
    prospectId: string
    hotelId: string
    hotelContactId: string | null
    attemptType: string
    outcome: string
    occurredAt: Date | null
    notes: string | null
    userId: string
    roleCode: string
  }): Promise<AttemptRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.contactAttempt.create({
        data: {
          id,
          prospectId: params.prospectId,
          hotelId: params.hotelId,
          hotelContactId: params.hotelContactId,
          attemptType: params.attemptType,
          outcome: params.outcome,
          notes: params.notes,
          userId: params.userId,
          ...(params.occurredAt ? { occurredAt: params.occurredAt } : {}),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.prospect',
          entityId: params.prospectId,
          eventType: 'CONTACT_ATTEMPTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { attemptType: params.attemptType, outcome: params.outcome },
        },
      })
    })

    return this.prisma.contactAttempt.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async listAll(prospectId: string): Promise<AttemptRow[]> {
    return this.prisma.contactAttempt.findMany({
      where: { prospectId },
      orderBy: { occurredAt: 'desc' },
      select: SELECT,
    })
  }

  async summaryOf(prospectId: string): Promise<{
    total: number
    byOutcome: Array<{ outcome: string; total: number }>
    lastAttemptAt: Date | null
  }> {
    const groups = await this.prisma.contactAttempt.groupBy({
      by: ['outcome'],
      where: { prospectId },
      _count: { _all: true },
    })

    const last = await this.prisma.contactAttempt.findFirst({
      where: { prospectId },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    })

    return {
      total: groups.reduce((total, g) => total + g._count._all, 0),
      byOutcome: OUTCOMES.map((outcome) => ({
        outcome,
        total: groups.find((g) => g.outcome === outcome)?._count._all ?? 0,
      })),
      lastAttemptAt: last?.occurredAt ?? null,
    }
  }
}
