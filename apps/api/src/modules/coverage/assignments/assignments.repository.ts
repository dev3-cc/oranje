import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export const COVERAGE_LIGHT = 'POSITION_COVERAGE'
export const REQUISITION_LIGHT = 'REQUISITION'

export interface AssignmentRow {
  id: string
  type: string
  status: string
  createdAt: Date
  slot: { id: string; ordinal: number; positionId: string }
  worker: { id: string; fullName: string }
}

const SELECT = {
  id: true,
  type: true,
  status: true,
  createdAt: true,
  slot: { select: { id: true, ordinal: true, positionId: true } },
  worker: { select: { id: true, fullName: true } },
} as const

@Injectable()
export class AssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async position(id: string): Promise<{
    id: string
    requisitionId: string
    quantity: number
    deletedAt: Date | null
    coverageStateId: string
    requisitionState: string
    requisitionStateId: string
  } | null> {
    const row = await this.prisma.position.findUnique({
      where: { id },
      select: {
        id: true,
        requisitionId: true,
        quantity: true,
        deletedAt: true,
        coverageStateId: true,
        requisition: {
          select: { statusLightStateId: true, statusState: { select: { code: true } } },
        },
      },
    })

    return row
      ? {
          id: row.id,
          requisitionId: row.requisitionId,
          quantity: row.quantity,
          deletedAt: row.deletedAt,
          coverageStateId: row.coverageStateId,
          requisitionState: row.requisition.statusState.code,
          requisitionStateId: row.requisition.statusLightStateId,
        }
      : null
  }

  async freeSlot(positionId: string): Promise<{ id: string; ordinal: number } | null> {
    return this.prisma.slot.findFirst({
      where: { positionId, status: 'free' },
      orderBy: { ordinal: 'asc' },
      select: { id: true, ordinal: true },
    })
  }

  async worker(id: string): Promise<{ id: string; fullName: string; deletedAt: Date | null } | null> {
    return this.prisma.worker.findUnique({
      where: { id },
      select: { id: true, fullName: true, deletedAt: true },
    })
  }

  async activeAssignmentOf(workerId: string): Promise<{ id: string } | null> {
    return this.prisma.assignment.findFirst({
      where: { workerId, status: 'ACTIVE' },
      select: { id: true },
    })
  }

  async byId(id: string): Promise<AssignmentRow | null> {
    return this.prisma.assignment.findUnique({ where: { id }, select: SELECT })
  }

  async listByRequisition(requisitionId: string): Promise<AssignmentRow[]> {
    return this.prisma.assignment.findMany({
      where: { slot: { position: { requisitionId } }, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: SELECT,
    })
  }

  async coverageOf(requisitionId: string): Promise<
    Array<{ positionId: string; quantity: number; taken: number; coverageStateId: string }>
  > {
    const rows = await this.prisma.position.findMany({
      where: { requisitionId, deletedAt: null },
      select: {
        id: true,
        quantity: true,
        coverageStateId: true,
        slots: { select: { status: true } },
      },
    })

    return rows.map((p) => ({
      positionId: p.id,
      quantity: p.quantity,
      taken: p.slots.filter((s) => s.status === 'taken').length,
      coverageStateId: p.coverageStateId,
    }))
  }

  async stateByCode(light: string, code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: light },
      select: { id: true },
    })
  }

  async assign(params: {
    slotId: string
    workerId: string
    type: string
    startDate: Date
    endDate: Date | null
    requisitionId: string
    positionId: string
    coverageStateId: string
    requisitionStateId: string | null
    fromRequisitionStateId: string
    userId: string
    roleCode: string
  }): Promise<AssignmentRow> {
    const id = uuidv7()
    const upper = params.endDate ? params.endDate.toISOString().slice(0, 10) : null
    const lower = params.startDate.toISOString().slice(0, 10)

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
        VALUES (
          ${id}::uuid,
          ${params.slotId}::uuid,
          ${params.workerId}::uuid,
          ${params.type},
          daterange(${lower}::date, ${upper}::date, '[)'),
          'ACTIVE',
          ${params.userId}::uuid
        )`

      await tx.slot.update({
        where: { id: params.slotId },
        data: { status: 'taken', updatedAt: new Date() },
      })

      await tx.position.update({
        where: { id: params.positionId },
        data: {
          coverageStateId: params.coverageStateId,
          coverageLightCode: COVERAGE_LIGHT,
          updatedAt: new Date(),
        },
      })

      if (params.requisitionStateId) {
        await tx.requisition.update({
          where: { id: params.requisitionId },
          data: {
            statusLightStateId: params.requisitionStateId,
            updatedAt: new Date(),
            updatedBy: params.userId,
          },
        })

        await tx.requisitionStateHistory.create({
          data: {
            id: uuidv7(),
            requisitionId: params.requisitionId,
            fromStateId: params.fromRequisitionStateId,
            toStateId: params.requisitionStateId,
            statusLightCode: REQUISITION_LIGHT,
            userId: params.userId,
          },
        })
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment',
          entityId: id,
          eventType: 'WORKER_ASSIGNED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            requisitionId: params.requisitionId,
            positionId: params.positionId,
            workerId: params.workerId,
            type: params.type,
          },
        },
      })
    })

    return this.prisma.assignment.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async release(params: {
    assignmentId: string
    slotId: string
    positionId: string
    coverageStateId: string
    reason: string
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: params.assignmentId },
        data: { status: 'CANCELLED', closedReason: params.reason, updatedAt: new Date() },
      })

      await tx.slot.update({
        where: { id: params.slotId },
        data: { status: 'free', updatedAt: new Date() },
      })

      await tx.position.update({
        where: { id: params.positionId },
        data: {
          coverageStateId: params.coverageStateId,
          coverageLightCode: COVERAGE_LIGHT,
          updatedAt: new Date(),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment',
          entityId: params.assignmentId,
          eventType: 'ASSIGNMENT_RELEASED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { reason: params.reason },
        },
      })
    })
  }
}
