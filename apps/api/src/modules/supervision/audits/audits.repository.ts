import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

const HEADER_SELECT = {
  id: true,
  auditType: true,
  hotelId: true,
  workerId: true,
  score: true,
  observations: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { id: true, name: true } },
  worker: { select: { id: true, fullName: true, photoPath: true } },
  supervisorUser: { select: { id: true, fullName: true } },
} as const

export type AuditHeaderRow = Prisma.AuditGetPayload<{ select: typeof HEADER_SELECT }>

const DETAIL_SELECT = {
  ...HEADER_SELECT,
  responses: {
    select: {
      id: true,
      checklistItemId: true,
      value: true,
      checklistItem: { select: { category: true, label: true, weight: true } },
    },
    orderBy: { checklistItem: { ordinal: 'asc' } },
  },
} as const

export type AuditDetailRow = Prisma.AuditGetPayload<{ select: typeof DETAIL_SELECT }>

export interface AuditFilter {
  page: number
  limit: number
  workerId?: string | undefined
  auditType?: string | undefined
}

export interface NewResponse {
  checklistItemId: string
  value: string
}

export interface ResponseChange {
  auditResponseId: string
  previousValue: string
  newValue: string
}

@Injectable()
export class AuditsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotelExists(hotelId: string): Promise<boolean> {
    return (await this.prisma.hotel.count({ where: { id: hotelId } })) > 0
  }

  // Mismo criterio que `WorkersRepository.isAssignedToHotel`: la relación
  // worker → assignment → slot → position → requisition → hotel cruza cuatro
  // esquemas, y ahí ya se resuelve con SQL crudo en vez de un include anidado.
  async isWorkerAssignedToHotel(workerId: string, hotelId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM coverage.assignment a
          JOIN demand.slot sl        ON sl.id = a.slot_id
          JOIN demand."position" p   ON p.id = sl.position_id
          JOIN demand.requisition r  ON r.id = p.requisition_id
         WHERE a.worker_id = ${workerId}::uuid
           AND a.status = 'ACTIVE'
           AND r.hotel_id = ${hotelId}::uuid) AS existe`

    return rows[0]?.existe ?? false
  }

  // Los `checklistItemId` que SÍ existen y SÍ son del `auditType` de la
  // auditoría — la FK compuesta de la base rechazaría el resto, pero
  // pre-validar da un 422 de negocio en vez de traducir un 500 del motor.
  async checklistItems(
    auditType: string,
    ids: string[],
  ): Promise<Map<string, { weight: Prisma.Decimal }>> {
    const rows = await this.prisma.auditChecklistItem.findMany({
      where: { id: { in: ids }, auditType },
      select: { id: true, weight: true },
    })

    return new Map(rows.map((r) => [r.id, { weight: r.weight }]))
  }

  async findById(id: string): Promise<AuditDetailRow | null> {
    return this.prisma.audit.findUnique({ where: { id }, select: DETAIL_SELECT })
  }

  async findMany(
    filter: AuditFilter,
    hotelId: string | null,
  ): Promise<{ rows: AuditHeaderRow[]; total: number }> {
    const where: Prisma.AuditWhereInput = {
      ...(hotelId ? { hotelId } : {}),
      ...(filter.workerId ? { workerId: filter.workerId } : {}),
      ...(filter.auditType ? { auditType: filter.auditType } : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.audit.findMany({
        where,
        select: HEADER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.audit.count({ where }),
    ])

    return { rows, total }
  }

  async create(params: {
    id: string
    auditType: string
    hotelId: string
    workerId: string | null
    supervisorUserId: string
    score: number
    observations: string | null
    responses: NewResponse[]
    userId: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.audit.create({
        data: {
          id: params.id,
          auditType: params.auditType,
          hotelId: params.hotelId,
          workerId: params.workerId,
          supervisorUserId: params.supervisorUserId,
          score: params.score,
          observations: params.observations,
          createdBy: params.userId,
        },
      })

      await tx.auditResponse.createMany({
        data: params.responses.map((r) => ({
          id: uuidv7(),
          auditId: params.id,
          checklistItemId: r.checklistItemId,
          auditType: params.auditType,
          value: r.value,
        })),
      })
    })
  }

  // Corregir: cada respuesta DISTINTA se actualiza y deja su fila de historia;
  // `score` ya viene recalculado con los valores nuevos. Una sola transacción.
  async correct(params: {
    auditId: string
    observations: string | undefined
    score: number
    changes: ResponseChange[]
    userId: string
  }): Promise<void> {
    const now = new Date()

    await this.prisma.$transaction(async (tx) => {
      for (const change of params.changes) {
        await tx.auditResponse.update({
          where: { id: change.auditResponseId },
          data: { value: change.newValue, updatedAt: now, updatedBy: params.userId },
        })

        await tx.auditResponseHistory.create({
          data: {
            id: uuidv7(),
            auditResponseId: change.auditResponseId,
            previousValue: change.previousValue,
            newValue: change.newValue,
            changedBy: params.userId,
          },
        })
      }

      await tx.audit.update({
        where: { id: params.auditId },
        data: {
          score: params.score,
          ...(params.observations !== undefined ? { observations: params.observations } : {}),
          updatedAt: now,
          updatedBy: params.userId,
        },
      })
    })
  }

  // La cabecera (observaciones) se corrige SIN historial propio — quedó fuera
  // de alcance en el diagrama.
  async updateHeader(id: string, observations: string, userId: string): Promise<void> {
    await this.prisma.audit.update({
      where: { id },
      data: { observations, updatedAt: new Date(), updatedBy: userId },
    })
  }

  // Colaboradores con asignación ACTIVA en el hotel — mismo cruce de esquemas
  // que `isWorkerAssignedToHotel`, en lote.
  async workersOfHotel(
    hotelId: string,
  ): Promise<Array<{ id: string; fullName: string; photoPath: string | null }>> {
    return this.prisma.$queryRaw<Array<{ id: string; fullName: string; photoPath: string | null }>>`
      SELECT DISTINCT w.id, w.full_name AS "fullName", w.photo_path AS "photoPath"
        FROM personal.worker w
        JOIN coverage.assignment a  ON a.worker_id = w.id AND a.status = 'ACTIVE'
        JOIN demand.slot sl         ON sl.id = a.slot_id
        JOIN demand."position" p    ON p.id = sl.position_id
        JOIN demand.requisition r   ON r.id = p.requisition_id
       WHERE r.hotel_id = ${hotelId}::uuid
       ORDER BY w.full_name`
  }

  // Usa `ix_audit_worker_recent` (worker_id, created_at DESC WHERE audit_type
  // = 'PERSONAL_PRESENTATION'): MAX(created_at) agrupado por worker_id.
  async lastPersonalAuditByWorker(workerIds: string[]): Promise<Map<string, Date>> {
    if (workerIds.length === 0) {
      return new Map()
    }

    const rows = await this.prisma.$queryRaw<Array<{ workerId: string; lastAuditedAt: Date }>>`
      SELECT worker_id AS "workerId", MAX(created_at) AS "lastAuditedAt"
        FROM supervision.audit
       WHERE audit_type = 'PERSONAL_PRESENTATION'
         AND worker_id = ANY(${workerIds}::uuid[])
       GROUP BY worker_id`

    return new Map(rows.map((r) => [r.workerId, r.lastAuditedAt]))
  }
}

export { HEADER_SELECT, DETAIL_SELECT }
