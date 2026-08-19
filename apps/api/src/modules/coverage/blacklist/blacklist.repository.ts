import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export const WORKER_LIGHT = 'WORKER'

export interface EntryRow {
  id: string
  source: string
  reason: string
  evidencePath: string | null
  occurredAt: Date
  liftedAt: Date | null
  liftReason: string | null
  worker: { id: string; fullName: string }
  enteredBy: { id: string; fullName: string }
  liftedBy: { id: string; fullName: string } | null
}

const SELECT = {
  id: true,
  source: true,
  reason: true,
  evidencePath: true,
  occurredAt: true,
  liftedAt: true,
  liftReason: true,
  worker: { select: { id: true, fullName: true } },
  enteredByUser: { select: { id: true, fullName: true } },
  liftedByUser: { select: { id: true, fullName: true } },
} as const

type Raw = {
  id: string
  source: string
  reason: string
  evidencePath: string | null
  occurredAt: Date
  liftedAt: Date | null
  liftReason: string | null
  worker: { id: string; fullName: string }
  enteredByUser: { id: string; fullName: string }
  liftedByUser: { id: string; fullName: string } | null
}

const shape = (r: Raw): EntryRow => ({
  id: r.id,
  source: r.source,
  reason: r.reason,
  evidencePath: r.evidencePath,
  occurredAt: r.occurredAt,
  liftedAt: r.liftedAt,
  liftReason: r.liftReason,
  worker: r.worker,
  enteredBy: r.enteredByUser,
  liftedBy: r.liftedByUser,
})

@Injectable()
export class BlacklistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async worker(
    id: string,
  ): Promise<{ id: string; fullName: string; stateId: string; stateCode: string } | null> {
    const row = await this.prisma.worker.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        deletedAt: true,
        statusLightStateId: true,
        statusState: { select: { code: true } },
      },
    })

    return row && row.deletedAt === null
      ? {
          id: row.id,
          fullName: row.fullName,
          stateId: row.statusLightStateId,
          stateCode: row.statusState.code,
        }
      : null
  }

  async stateByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: WORKER_LIGHT },
      select: { id: true },
    })
  }

  async activeOf(workerId: string): Promise<EntryRow | null> {
    const row = await this.prisma.blacklistEntry.findFirst({
      where: { workerId, liftedAt: null },
      select: SELECT,
    })

    return row ? shape(row) : null
  }

  async byId(id: string): Promise<EntryRow | null> {
    const row = await this.prisma.blacklistEntry.findUnique({ where: { id }, select: SELECT })

    return row ? shape(row) : null
  }

  async listAll(params: {
    workerId?: string | undefined
    onlyActive: boolean
  }): Promise<EntryRow[]> {
    const rows = await this.prisma.blacklistEntry.findMany({
      where: {
        ...(params.workerId ? { workerId: params.workerId } : {}),
        ...(params.onlyActive ? { liftedAt: null } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      select: SELECT,
    })

    return rows.map(shape)
  }

  async create(params: {
    workerId: string
    source: string
    reason: string
    evidencePath: string | null
    fromStateId: string
    toStateId: string
    userId: string
    roleCode: string
  }): Promise<string> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.blacklistEntry.create({
        data: {
          id,
          workerId: params.workerId,
          source: params.source,
          reason: params.reason,
          evidencePath: params.evidencePath,
          enteredBy: params.userId,
        },
      })

      await tx.worker.update({
        where: { id: params.workerId },
        data: {
          statusLightStateId: params.toStateId,
          statusLightCode: WORKER_LIGHT,
          updatedAt: new Date(),
        },
      })

      await tx.workerStateHistory.create({
        data: {
          id: uuidv7(),
          workerId: params.workerId,
          fromStateId: params.fromStateId,
          toStateId: params.toStateId,
          statusLightCode: WORKER_LIGHT,
          userId: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.blacklist_entry',
          entityId: id,
          eventType: 'WORKER_BLACKLISTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { workerId: params.workerId, source: params.source, reason: params.reason },
        },
      })
    })

    return id
  }

  async lift(params: {
    entryId: string
    workerId: string
    liftReason: string
    fromStateId: string
    toStateId: string
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.blacklistEntry.update({
        where: { id: params.entryId },
        data: {
          liftedAt: new Date(),
          liftedBy: params.userId,
          liftReason: params.liftReason,
        },
      })

      await tx.worker.update({
        where: { id: params.workerId },
        data: {
          statusLightStateId: params.toStateId,
          statusLightCode: WORKER_LIGHT,
          updatedAt: new Date(),
        },
      })

      await tx.workerStateHistory.create({
        data: {
          id: uuidv7(),
          workerId: params.workerId,
          fromStateId: params.fromStateId,
          toStateId: params.toStateId,
          statusLightCode: WORKER_LIGHT,
          userId: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.blacklist_entry',
          entityId: params.entryId,
          eventType: 'BLACKLIST_LIFTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { workerId: params.workerId, liftReason: params.liftReason },
        },
      })
    })
  }
}
