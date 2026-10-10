import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface PayAdjustmentRow {
  id: string
  assignmentId: string
  amount: string
  reason: string
  status: string
  settlementEffect: string | null
  requestedAt: Date
  approvedAt: Date | null
  rejectionReason: string | null
  includedAt: Date | null
  payConcept: { id: string; code: string; name: string } | null
  requestedByUser: { id: string; fullName: string }
  approvedByUser: { id: string; fullName: string } | null
  includedByUser: { id: string; fullName: string } | null
  worker: { id: string; fullName: string }
  hotelName: string
  requisitionNumber: string
}

const SELECT = {
  id: true,
  assignmentId: true,
  amount: true,
  reason: true,
  status: true,
  settlementEffect: true,
  requestedAt: true,
  approvedAt: true,
  rejectionReason: true,
  includedAt: true,
  payConcept: { select: { id: true, code: true, name: true } },
  requestedByUser: { select: { id: true, fullName: true } },
  approvedByUser: { select: { id: true, fullName: true } },
  includedByUser: { select: { id: true, fullName: true } },
  assignment: {
    select: {
      worker: { select: { id: true, fullName: true } },
      slot: {
        select: {
          position: {
            select: {
              requisition: { select: { number: true, hotel: { select: { name: true } } } },
            },
          },
        },
      },
    },
  },
} as const

type RawRow = {
  id: string
  assignmentId: string
  amount: { toFixed(decimals: number): string }
  reason: string
  status: string
  settlementEffect: string | null
  requestedAt: Date
  approvedAt: Date | null
  rejectionReason: string | null
  includedAt: Date | null
  payConcept: { id: string; code: string; name: string } | null
  requestedByUser: { id: string; fullName: string }
  approvedByUser: { id: string; fullName: string } | null
  includedByUser: { id: string; fullName: string } | null
  assignment: {
    worker: { id: string; fullName: string }
    slot: { position: { requisition: { number: string; hotel: { name: string } } } }
  }
}

function toRow(row: RawRow): PayAdjustmentRow {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    /* Decimal.js recorta ceros de sobra en `toString()` (180.00 → "180") —
       el dinero siempre con dos decimales, como el resto de la app. */
    amount: row.amount.toFixed(2),
    reason: row.reason,
    status: row.status,
    settlementEffect: row.settlementEffect,
    requestedAt: row.requestedAt,
    approvedAt: row.approvedAt,
    rejectionReason: row.rejectionReason,
    includedAt: row.includedAt,
    payConcept: row.payConcept,
    requestedByUser: row.requestedByUser,
    approvedByUser: row.approvedByUser,
    includedByUser: row.includedByUser,
    worker: row.assignment.worker,
    hotelName: row.assignment.slot.position.requisition.hotel.name,
    requisitionNumber: row.assignment.slot.position.requisition.number,
  }
}

@Injectable()
export class PayAdjustmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assignment(id: string): Promise<{ id: string; type: string; status: string } | null> {
    return this.prisma.assignment.findUnique({
      where: { id },
      select: { id: true, type: true, status: true },
    })
  }

  async payConceptExists(id: string): Promise<boolean> {
    return (await this.prisma.payConcept.count({ where: { id } })) > 0
  }

  async create(params: {
    assignmentId: string
    payConceptId: string | null
    amount: string
    reason: string
    settlementEffect: string | null
    userId: string
    roleCode: string
  }): Promise<PayAdjustmentRow> {
    const id = uuidv7()

    return this.prisma.$transaction(async (tx) => {
      await tx.assignmentPayAdjustment.create({
        data: {
          id,
          assignmentId: params.assignmentId,
          payConceptId: params.payConceptId,
          amount: params.amount,
          reason: params.reason,
          settlementEffect: params.settlementEffect,
          requestedBy: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment_pay_adjustment',
          entityId: id,
          eventType: 'PAY_ADJUSTMENT_REQUESTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            assignmentId: params.assignmentId,
            payConceptId: params.payConceptId,
            amount: params.amount,
            settlementEffect: params.settlementEffect,
          },
        },
      })

      const row = await tx.assignmentPayAdjustment.findUniqueOrThrow({
        where: { id },
        select: SELECT,
      })
      return toRow(row)
    })
  }

  async byId(id: string): Promise<PayAdjustmentRow | null> {
    const row = await this.prisma.assignmentPayAdjustment.findUnique({
      where: { id },
      select: SELECT,
    })
    return row ? toRow(row) : null
  }

  async byAssignment(assignmentId: string): Promise<PayAdjustmentRow[]> {
    const rows = await this.prisma.assignmentPayAdjustment.findMany({
      where: { assignmentId },
      select: SELECT,
      orderBy: { requestedAt: 'desc' },
    })
    return rows.map((row) => toRow(row as RawRow))
  }

  /** La cola del Observador: todo lo PENDING, del más viejo al más nuevo, de cualquier hotel. */
  async pending(): Promise<PayAdjustmentRow[]> {
    const rows = await this.prisma.assignmentPayAdjustment.findMany({
      where: { status: 'PENDING' },
      select: SELECT,
      orderBy: { requestedAt: 'asc' },
    })
    return rows.map((row) => toRow(row as RawRow))
  }

  /** La cola de Contabilidad: todo lo APPROVED sin incluir, del más viejo al más nuevo. */
  async approvedPendingInclusion(): Promise<PayAdjustmentRow[]> {
    const rows = await this.prisma.assignmentPayAdjustment.findMany({
      where: { status: 'APPROVED', includedAt: null },
      select: SELECT,
      orderBy: { approvedAt: 'asc' },
    })
    return rows.map((row) => toRow(row as RawRow))
  }

  async resolve(params: {
    id: string
    status: 'APPROVED' | 'REJECTED'
    rejectionReason: string | null
    userId: string
    roleCode: string
  }): Promise<PayAdjustmentRow> {
    return this.prisma.$transaction(async (tx) => {
      await tx.assignmentPayAdjustment.update({
        where: { id: params.id },
        data: {
          status: params.status,
          approvedBy: params.userId,
          approvedAt: new Date(),
          rejectionReason: params.rejectionReason,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment_pay_adjustment',
          entityId: params.id,
          eventType:
            params.status === 'APPROVED' ? 'PAY_ADJUSTMENT_APPROVED' : 'PAY_ADJUSTMENT_REJECTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { rejectionReason: params.rejectionReason },
        },
      })

      const row = await tx.assignmentPayAdjustment.findUniqueOrThrow({
        where: { id: params.id },
        select: SELECT,
      })
      return toRow(row)
    })
  }

  async include(params: { id: string; userId: string; roleCode: string }): Promise<PayAdjustmentRow> {
    return this.prisma.$transaction(async (tx) => {
      await tx.assignmentPayAdjustment.update({
        where: { id: params.id },
        data: { includedBy: params.userId, includedAt: new Date() },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment_pay_adjustment',
          entityId: params.id,
          eventType: 'PAY_ADJUSTMENT_INCLUDED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {},
        },
      })

      const row = await tx.assignmentPayAdjustment.findUniqueOrThrow({
        where: { id: params.id },
        select: SELECT,
      })
      return toRow(row)
    })
  }
}
