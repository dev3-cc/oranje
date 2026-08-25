import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export const REQUISITION_LIGHT = 'REQUISITION'
export const COVERAGE_LIGHT = 'POSITION_COVERAGE'
export const URGENCY_LIGHT = 'URGENCY'

const STATUS = { code: true, color: true, name: true } as const

const SELECT = {
  id: true,
  number: true,
  areaManagerUserId: true,
  authorizedBy: true,
  authorizedAt: true,
  inspectorId: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { id: true, name: true } },
  statusState: { select: STATUS },
  positions: {
    where: { deletedAt: null },
    orderBy: { lineNumber: 'asc' },
    select: {
      id: true,
      lineNumber: true,
      quantity: true,
      startDate: true,
      startTime: true,
      notes: true,
      catalogPosition: { select: { id: true, code: true, name: true } },
      hiringModality: { select: { id: true, code: true, name: true } },
      englishLevel: { select: { id: true, code: true, name: true } },
      hotelDepartment: { select: { id: true, code: true, name: true } },
      coverageState: { select: STATUS },
      urgencyState: { select: STATUS },
      slots: { select: { status: true } },
    },
  },
} as const

export type RequisitionRow = Prisma.RequisitionGetPayload<{ select: typeof SELECT }>

export interface NewPosition {
  catalogPositionId: string
  hiringModalityId: string
  hotelDepartmentId: string
  englishLevelId: string | null
  quantity: number
  startDate: Date
  startTime: string | null
  notes: string | null
}

export interface RequisitionFilter {
  page: number
  limit: number
  state?: string | undefined
  hotelId?: string | undefined
  departmentId?: string | undefined
  urgency?: string | undefined
  includeDeleted: boolean
}

@Injectable()
export class RequisitionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async stateByCode(light: string, code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: light },
      select: { id: true },
    })
  }

  async hotelExists(hotelId: string): Promise<boolean> {
    return (await this.prisma.hotel.count({ where: { id: hotelId } })) > 0
  }

  async catalogPositions(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.catalogPosition.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })

    return new Set(rows.map((r) => r.id))
  }

  async modalities(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.hiringModality.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })

    return new Set(rows.map((r) => r.id))
  }

  async departments(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.hotelDepartment.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })

    return new Set(rows.map((r) => r.id))
  }

  async englishLevels(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.englishLevel.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })

    return new Set(rows.map((r) => r.id))
  }

  async findById(id: string): Promise<RequisitionRow | null> {
    return this.prisma.requisition.findUnique({ where: { id }, select: SELECT })
  }

  async findMany(
    filter: RequisitionFilter,
    hotelIds: string[] | null,
    departmentId: string | null,
    /** Estados que el caller NO puede ver (la cola de la Reclutadora excluye el borrador). */
    excludeStates: string[] | null = null,
  ): Promise<{ rows: RequisitionRow[]; total: number }> {
    const where: Prisma.RequisitionWhereInput = {
      ...(filter.includeDeleted ? {} : { deletedAt: null }),
      /** `state` y `excludeStates` conviven: pedir un estado excluido da vacío, no un bypass. */
      ...(filter.state ? { statusState: { code: filter.state } } : {}),
      ...(excludeStates ? { AND: [{ statusState: { code: { notIn: excludeStates } } }] } : {}),
      ...(filter.hotelId ? { hotelId: filter.hotelId } : {}),
      ...(hotelIds ? { hotelId: { in: hotelIds } } : {}),
      ...(filter.departmentId || departmentId
        ? { positions: { some: { hotelDepartmentId: filter.departmentId ?? departmentId ?? '' } } }
        : {}),
      ...(filter.urgency
        ? { positions: { some: { urgencyState: { code: filter.urgency } } } }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.requisition.findMany({
        where,
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.requisition.count({ where }),
    ])

    return { rows, total }
  }

  async create(params: {
    number: string
    hotelId: string
    stateId: string
    coverageStateId: string
    areaManagerUserId: string | null
    positions: NewPosition[]
    userId: string
    roleCode: string
  }): Promise<RequisitionRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.requisition.create({
        data: {
          id,
          number: params.number,
          hotelId: params.hotelId,
          statusLightStateId: params.stateId,
          statusLightCode: REQUISITION_LIGHT,
          areaManagerUserId: params.areaManagerUserId,
          createdBy: params.userId,
          updatedBy: params.userId,
        },
      })

      for (const [index, p] of params.positions.entries()) {
        const positionId = uuidv7()

        await tx.position.create({
          data: {
            id: positionId,
            requisitionId: id,
            lineNumber: index + 1,
            catalogPositionId: p.catalogPositionId,
            hiringModalityId: p.hiringModalityId,
            hotelDepartmentId: p.hotelDepartmentId,
            englishLevelId: p.englishLevelId,
            quantity: p.quantity,
            startDate: p.startDate,
            ...(p.startTime ? { startTime: new Date(`1970-01-01T${p.startTime}:00Z`) } : {}),
            notes: p.notes,
            coverageStateId: params.coverageStateId,
            coverageLightCode: COVERAGE_LIGHT,
          },
        })

        await tx.slot.createMany({
          data: Array.from({ length: p.quantity }, (_, n) => ({
            id: uuidv7(),
            positionId,
            ordinal: n + 1,
          })),
        })
      }

      await tx.requisitionStateHistory.create({
        data: {
          id: uuidv7(),
          requisitionId: id,
          fromStateId: null,
          toStateId: params.stateId,
          statusLightCode: REQUISITION_LIGHT,
          userId: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'demand.requisition',
          entityId: id,
          eventType: 'REQUISITION_CREATED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { number: params.number, positions: params.positions.length },
        },
      })
    })

    return this.prisma.requisition.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async authorize(params: {
    id: string
    fromStateId: string
    toStateId: string
    coverageStateId: string
    urgencyByPosition: Array<{ positionId: string; urgencyStateId: string }>
    userId: string
    roleCode: string
  }): Promise<RequisitionRow> {
    const now = new Date()

    await this.prisma.$transaction(async (tx) => {
      await tx.requisition.update({
        where: { id: params.id },
        data: {
          statusLightStateId: params.toStateId,
          authorizedBy: params.userId,
          authorizedAt: now,
          updatedAt: now,
          updatedBy: params.userId,
        },
      })

      for (const u of params.urgencyByPosition) {
        await tx.position.update({
          where: { id: u.positionId },
          data: {
            urgencyStateId: u.urgencyStateId,
            urgencyLightCode: URGENCY_LIGHT,
            coverageStateId: params.coverageStateId,
            coverageLightCode: COVERAGE_LIGHT,
            updatedAt: now,
          },
        })
      }

      await tx.requisitionStateHistory.create({
        data: {
          id: uuidv7(),
          requisitionId: params.id,
          fromStateId: params.fromStateId,
          toStateId: params.toStateId,
          statusLightCode: REQUISITION_LIGHT,
          userId: params.userId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'demand.requisition',
          entityId: params.id,
          eventType: 'REQUISITION_AUTHORIZED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { positions: params.urgencyByPosition.length },
        },
      })
    })

    return this.prisma.requisition.findUniqueOrThrow({ where: { id: params.id }, select: SELECT })
  }

  async numberTaken(number: string): Promise<boolean> {
    return (await this.prisma.requisition.count({ where: { number } })) > 0
  }
}
