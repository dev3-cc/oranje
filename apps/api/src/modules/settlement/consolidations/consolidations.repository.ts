import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface ConsolidationRow {
  id: string
  weekStart: Date
  weekEnd: Date
  status: string
  runKind: string
  grossAmount: string
  deductionAmount: string
  netAmount: string
  validatedAt: Date | null
  authorizedAt: Date | null
  paidAt: Date | null
  worker: { id: string; fullName: string }
  hotel: { id: string; name: string }
}

export interface DetailRow {
  id: string
  hotelName: string
  positionName: string
  regularMinutes: number
  overtimeMinutes: number
  payRateApplied: string
  overtimeMultiplierApplied: string
  isInternalRate: boolean
  subtotal: string
}

export interface DeductionRow {
  id: string
  type: string
  amount: string
  sourceNote: string | null
  refundedAt: Date | null
}

@Injectable()
export class ConsolidationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Mientras dure la migracion de correo, la cuenta vieja tambien resuelve al
  // mismo colaborador (Worker.legacyUserId, D-XX).
  async workerOfUser(userId: string): Promise<string | null> {
    const row = await this.prisma.worker.findFirst({
      where: { OR: [{ userId }, { legacyUserId: userId }], deletedAt: null },
      select: { id: true },
    })

    return row?.id ?? null
  }

  // Solo PAID. El filtro va en la consulta y no en el servicio: asi no hay
  // forma de llamar a esto y recibir de mas.
  async paidOfWorker(workerId: string): Promise<
    Array<{
      id: string
      weekStart: Date
      weekEnd: Date
      netAmount: string
      paidAt: Date | null
      hotels: string[]
      minutes: number
    }>
  > {
    return this.prisma.$queryRaw`
      SELECT c.id,
             c.week_start   AS "weekStart",
             c.week_end     AS "weekEnd",
             c.net_amount::text AS "netAmount",
             c.paid_at      AS "paidAt",
             COALESCE(array_agg(DISTINCT h.name) FILTER (WHERE h.name IS NOT NULL), '{}') AS hotels,
             COALESCE(SUM(d.regular_minutes + d.overtime_minutes), 0)::int AS "minutes"
        FROM settlement.consolidation c
        LEFT JOIN settlement.consolidation_detail d ON d.consolidation_id = c.id
        LEFT JOIN demand.requisition r ON r.id = d.requisition_id
        LEFT JOIN commercial.hotel h   ON h.id = r.hotel_id
       WHERE c.worker_id = ${workerId}::uuid
         AND c.status = 'PAID'
       GROUP BY c.id
       ORDER BY c.week_start DESC
       LIMIT 52`
  }

  async byId(id: string): Promise<ConsolidationRow | null> {
    const rows = await this.prisma.$queryRaw<ConsolidationRow[]>`
      SELECT c.id,
             c.week_start        AS "weekStart",
             c.week_end          AS "weekEnd",
             c.status,
             c.run_kind         AS "runKind",
             c.gross_amount::text     AS "grossAmount",
             c.deduction_amount::text AS "deductionAmount",
             c.net_amount::text       AS "netAmount",
             c.validated_at  AS "validatedAt",
             c.authorized_at AS "authorizedAt",
             c.paid_at       AS "paidAt",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker,
             jsonb_build_object('id', h.id, 'name', h.name) AS hotel
        FROM settlement.consolidation c
        JOIN personal.worker w ON w.id = c.worker_id
        JOIN commercial.hotel h ON h.id = c.hotel_id
       WHERE c.id = ${id}::uuid`

    return rows[0] ?? null
  }

  async listAll(weekStart: Date | null, status: string | null): Promise<ConsolidationRow[]> {
    const day = weekStart ? weekStart.toISOString().slice(0, 10) : null

    return this.prisma.$queryRaw<ConsolidationRow[]>`
      SELECT c.id,
             c.week_start        AS "weekStart",
             c.week_end          AS "weekEnd",
             c.status,
             c.run_kind         AS "runKind",
             c.gross_amount::text     AS "grossAmount",
             c.deduction_amount::text AS "deductionAmount",
             c.net_amount::text       AS "netAmount",
             c.validated_at  AS "validatedAt",
             c.authorized_at AS "authorizedAt",
             c.paid_at       AS "paidAt",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker,
             jsonb_build_object('id', h.id, 'name', h.name) AS hotel
        FROM settlement.consolidation c
        JOIN personal.worker w ON w.id = c.worker_id
        JOIN commercial.hotel h ON h.id = c.hotel_id
       WHERE (${day}::date IS NULL OR c.week_start = ${day}::date)
         AND (${status}::text IS NULL OR c.status = ${status}::text)
       ORDER BY c.week_start DESC, w.full_name, h.name
       LIMIT 200`
  }

  async details(consolidationId: string): Promise<DetailRow[]> {
    return this.prisma.$queryRaw<DetailRow[]>`
      SELECT d.id,
             h.name AS "hotelName",
             cp.name AS "positionName",
             d.regular_minutes  AS "regularMinutes",
             d.overtime_minutes AS "overtimeMinutes",
             d.pay_rate_applied::text            AS "payRateApplied",
             d.overtime_multiplier_applied::text AS "overtimeMultiplierApplied",
             d.is_internal_rate AS "isInternalRate",
             d.subtotal::text   AS "subtotal"
        FROM settlement.consolidation_detail d
        JOIN commercial.hotel h        ON h.id = d.hotel_id
        JOIN catalogs."position" cp    ON cp.id = d.catalog_position_id
       WHERE d.consolidation_id = ${consolidationId}::uuid
       ORDER BY h.name`
  }

  async deductions(consolidationId: string): Promise<DeductionRow[]> {
    return this.prisma.$queryRaw<DeductionRow[]>`
      SELECT id, type, amount::text AS amount,
             source_note AS "sourceNote", refunded_at AS "refundedAt"
        FROM settlement.deduction
       WHERE consolidation_id = ${consolidationId}::uuid
       ORDER BY created_at`
  }

  async addDeduction(params: {
    consolidationId: string
    type: string
    amount: string
    sourceNote: string | null
    userId: string
    roleCode: string
  }): Promise<string> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO settlement.deduction (id, consolidation_id, type, amount, source_note)
        VALUES (${id}::uuid, ${params.consolidationId}::uuid, ${params.type},
                ${params.amount}::numeric, ${params.sourceNote})`

      await tx.$executeRaw`
        UPDATE settlement.consolidation c
           SET deduction_amount = s.total,
               net_amount       = c.gross_amount - s.total,
               updated_at       = now()
          FROM (SELECT COALESCE(sum(amount), 0) AS total
                  FROM settlement.deduction
                 WHERE consolidation_id = ${params.consolidationId}::uuid
                   AND refunded_at IS NULL) s
         WHERE c.id = ${params.consolidationId}::uuid`

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'settlement.consolidation',
          entityId: params.consolidationId,
          eventType: 'DEDUCTION_APPLIED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { type: params.type, amount: params.amount },
        },
      })
    })

    return id
  }

  async setStatus(params: {
    id: string
    status: string
    column: 'validated' | 'authorized' | 'paid' | null
    userId: string
    roleCode: string
    event: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (params.column === 'validated') {
        await tx.$executeRaw`
          UPDATE settlement.consolidation
             SET status = ${params.status}, validated_by = ${params.userId}::uuid,
                 validated_at = now(), updated_at = now()
           WHERE id = ${params.id}::uuid`
      } else if (params.column === 'authorized') {
        await tx.$executeRaw`
          UPDATE settlement.consolidation
             SET status = ${params.status}, authorized_by = ${params.userId}::uuid,
                 authorized_at = now(), updated_at = now()
           WHERE id = ${params.id}::uuid`
      } else {
        await tx.$executeRaw`
          UPDATE settlement.consolidation
             SET status = ${params.status}, paid_at = now(), updated_at = now()
           WHERE id = ${params.id}::uuid`
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'settlement.consolidation',
          entityId: params.id,
          eventType: params.event,
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { status: params.status },
        },
      })
    })
  }
}
