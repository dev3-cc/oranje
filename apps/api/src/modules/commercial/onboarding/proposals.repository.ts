import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

const SELECT = {
  id: true,
  version: true,
  servicesNote: true,
  payRate: true,
  billRate: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
  sentBy: { select: { id: true, fullName: true } },
} as const

export type ProposalRow = {
  id: string
  version: number
  servicesNote: string | null
  payRate: Prisma.Decimal | null
  billRate: Prisma.Decimal | null
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date | null
  sentBy: { id: string; fullName: string } | null
}

@Injectable()
export class ProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async prospect(
    id: string,
  ): Promise<{ id: string; hotelId: string; closedAt: Date | null } | null> {
    return this.prisma.prospect.findUnique({
      where: { id },
      select: { id: true, hotelId: true, closedAt: true },
    })
  }

  async findById(prospectId: string, id: string): Promise<ProposalRow | null> {
    return this.prisma.proposal.findFirst({ where: { id, prospectId }, select: SELECT })
  }

  async listAll(prospectId: string): Promise<ProposalRow[]> {
    return this.prisma.proposal.findMany({
      where: { prospectId },
      orderBy: { version: 'desc' },
      select: SELECT,
    })
  }

  async lastSent(prospectId: string): Promise<{ id: string; version: number } | null> {
    return this.prisma.proposal.findFirst({
      where: { prospectId, sentAt: { not: null } },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    })
  }

  async openDraft(prospectId: string): Promise<{ id: string; version: number } | null> {
    return this.prisma.proposal.findFirst({
      where: { prospectId, sentAt: null },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    })
  }

  /**
   * La versión se calcula dentro de la transacción y el índice único
   * `ux_proposal_prospect_version` es lo que de verdad impide el empate:
   * dos BD guardando a la vez leerían el mismo máximo.
   */
  async create(params: {
    prospectId: string
    servicesNote: string | null
    payRate: string | null
    billRate: string | null
    userId: string
    roleCode: string
  }): Promise<ProposalRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      const last = await tx.proposal.findFirst({
        where: { prospectId: params.prospectId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })

      const version = (last?.version ?? 0) + 1

      await tx.proposal.create({
        data: {
          id,
          prospectId: params.prospectId,
          version,
          servicesNote: params.servicesNote,
          payRate: params.payRate,
          billRate: params.billRate,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.prospect',
          entityId: params.prospectId,
          eventType: 'PROPOSAL_DRAFTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { proposalId: id, version },
        },
      })
    })

    return this.prisma.proposal.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async send(params: {
    prospectId: string
    proposalId: string
    userId: string
    roleCode: string
  }): Promise<ProposalRow> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id: params.proposalId },
        data: { sentAt: new Date(), sentByUserId: params.userId, updatedAt: new Date() },
        select: { version: true },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.prospect',
          entityId: params.prospectId,
          eventType: 'PROPOSAL_SENT',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { proposalId: params.proposalId, version: updated.version },
        },
      })
    })

    return this.prisma.proposal.findUniqueOrThrow({
      where: { id: params.proposalId },
      select: SELECT,
    })
  }

  async update(params: {
    prospectId: string
    proposalId: string
    servicesNote: string | null
    payRate: string | null
    billRate: string | null
    userId: string
    roleCode: string
  }): Promise<ProposalRow> {
    await this.prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: params.proposalId },
        data: {
          servicesNote: params.servicesNote,
          payRate: params.payRate,
          billRate: params.billRate,
          updatedAt: new Date(),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.prospect',
          entityId: params.prospectId,
          eventType: 'PROPOSAL_UPDATED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { proposalId: params.proposalId },
        },
      })
    })

    return this.prisma.proposal.findUniqueOrThrow({
      where: { id: params.proposalId },
      select: SELECT,
    })
  }
}
