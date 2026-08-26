import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface RateRow {
  id: string
  rate: string
  validFrom: Date
  validTo: Date | null
  reason: string | null
  createdAt: Date
  position: { id: string; code: string; name: string } | null
  authorizedBy: { id: string; fullName: string }
}

const BASE = `
  SELECT r.id,
         r.rate::text AS rate,
         r.valid_from AS "validFrom",
         r.valid_to   AS "validTo",
         r.reason,
         r.created_at AS "createdAt",
         CASE WHEN p.id IS NULL THEN NULL ELSE
           jsonb_build_object('id', p.id, 'code', p.code, 'name', p.name) END AS position,
         jsonb_build_object('id', u.id, 'fullName', u.full_name) AS "authorizedBy"
    FROM personal.worker_rate r
    JOIN identity."user" u ON u.id = r.authorized_by
    LEFT JOIN catalogs."position" p ON p.id = r.catalog_position_id`

@Injectable()
export class RatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async worker(id: string): Promise<{ id: string; fullName: string } | null> {
    const row = await this.prisma.worker.findUnique({
      where: { id },
      select: { id: true, fullName: true, deletedAt: true },
    })

    return row && row.deletedAt === null ? { id: row.id, fullName: row.fullName } : null
  }

  async positionExists(id: string): Promise<boolean> {
    return (await this.prisma.catalogPosition.count({ where: { id } })) > 0
  }

  async listAll(workerId: string): Promise<RateRow[]> {
    return this.prisma.$queryRawUnsafe<RateRow[]>(
      `${BASE} WHERE r.worker_id = $1::uuid ORDER BY r.valid_from DESC`,
      workerId,
    )
  }

  async byId(workerId: string, id: string): Promise<RateRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<RateRow[]>(
      `${BASE} WHERE r.id = $1::uuid AND r.worker_id = $2::uuid`,
      id,
      workerId,
    )

    return rows[0] ?? null
  }

  async activeFor(
    workerId: string,
    catalogPositionId: string | null,
  ): Promise<{ id: string; rate: string; validFrom: Date } | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; rate: string; validFrom: Date }>>`
      SELECT id, rate::text AS rate, valid_from AS "validFrom"
        FROM personal.worker_rate
       WHERE worker_id = ${workerId}::uuid
         AND valid_to IS NULL
         AND catalog_position_id IS NOT DISTINCT FROM ${catalogPositionId}::uuid`

    return rows[0] ?? null
  }

  async create(params: {
    workerId: string
    rate: string
    catalogPositionId: string | null
    validFrom: Date
    reason: string | null
    userId: string
    roleCode: string
    closes: string | null
  }): Promise<string> {
    const id = uuidv7()
    const from = params.validFrom.toISOString().slice(0, 10)

    await this.prisma.$transaction(async (tx) => {
      if (params.closes) {
        await tx.workerRate.update({
          where: { id: params.closes },
          data: { validTo: params.validFrom },
        })
      }

      await tx.$executeRaw`
        INSERT INTO personal.worker_rate
          (id, worker_id, catalog_position_id, rate, valid_from, authorized_by, reason)
        VALUES (${id}::uuid, ${params.workerId}::uuid, ${params.catalogPositionId}::uuid,
                ${params.rate}::numeric, ${from}::date, ${params.userId}::uuid, ${params.reason})`

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker_rate',
          entityId: id,
          eventType: params.closes ? 'WORKER_RATE_RAISED' : 'WORKER_RATE_SET',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            workerId: params.workerId,
            rate: params.rate,
            catalogPositionId: params.catalogPositionId,
            replaces: params.closes,
          },
        },
      })
    })

    return id
  }

  async close(params: {
    id: string
    workerId: string
    validTo: Date
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.workerRate.update({
        where: { id: params.id },
        data: { validTo: params.validTo },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'personal.worker_rate',
          entityId: params.id,
          eventType: 'WORKER_RATE_CLOSED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { workerId: params.workerId, validTo: params.validTo.toISOString() },
        },
      })
    })
  }
}
