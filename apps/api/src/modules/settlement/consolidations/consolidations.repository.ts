import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface ConsolidationRow {
  id: string
  weekStart: Date
  weekEnd: Date
  status: string
  grossAmount: string
  deductionAmount: string
  netAmount: string
  validatedAt: Date | null
  authorizedAt: Date | null
  paidAt: Date | null
  worker: { id: string; fullName: string }
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

  async pendingWeeks(weekStart: Date): Promise<number> {
    const day = weekStart.toISOString().slice(0, 10)

    const rows = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total
        FROM operations.timesheet
       WHERE week_start = ${day}::date
         AND status = 'APPROVED'`

    return Number(rows[0]?.total ?? 0)
  }

  async generate(params: {
    weekStart: Date
    userId: string
  }): Promise<Array<{ id: string; workerId: string }>> {
    const day = params.weekStart.toISOString().slice(0, 10)

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.$queryRaw<Array<{ id: string; workerId: string }>>`
        WITH horas AS (
          SELECT t.id            AS timesheet_id,
                 t.worker_id,
                 t.week_start,
                 t.week_end,
                 t.requisition_id,
                 r.hotel_id,
                 p.catalog_position_id,
                 sum(v.net_minutes)::int      AS regular_minutes,
                 sum(d.overtime_minutes)::int AS overtime_minutes
            FROM operations.timesheet t
            JOIN operations.timesheet_day d   ON d.timesheet_id = t.id
            JOIN operations.vw_timesheet_day v ON v.id = d.id
            JOIN demand.requisition r         ON r.id = t.requisition_id
            JOIN demand."position" p          ON p.requisition_id = r.id AND p.deleted_at IS NULL
           WHERE t.week_start = ${day}::date
             AND t.status = 'APPROVED'
             AND NOT EXISTS (
                   SELECT 1 FROM settlement.consolidation c
                    WHERE c.worker_id = t.worker_id AND c.week_start = t.week_start)
           GROUP BY t.id, t.worker_id, t.week_start, t.week_end, t.requisition_id,
                    r.hotel_id, p.catalog_position_id
        ),
        tarifas AS (
          SELECT h.*,
                 COALESCE(wr.rate, cr.pay_rate)            AS pay_rate,
                 (wr.rate IS NOT NULL)                     AS is_internal,
                 COALESCE(ct.overtime_pay_multiplier, 1.0) AS ot_multiplier
            FROM horas h
            LEFT JOIN personal.worker_rate wr
                   ON wr.worker_id = h.worker_id
                  AND wr.valid_to IS NULL
                  AND (wr.catalog_position_id = h.catalog_position_id
                       OR wr.catalog_position_id IS NULL)
            LEFT JOIN commercial.contract ct
                   ON ct.hotel_id = h.hotel_id AND ct.status = 'ACTIVE'
            LEFT JOIN commercial.contract_rate cr
                   ON cr.contract_id = ct.id
                  AND cr.catalog_position_id = h.catalog_position_id
        ),
        montos AS (
          SELECT *,
                 round(
                   (regular_minutes  / 60.0) * pay_rate
                 + (overtime_minutes / 60.0) * pay_rate * ot_multiplier
                 , 2) AS subtotal
            FROM tarifas
           WHERE pay_rate IS NOT NULL
        ),
        cabeza AS (
          INSERT INTO settlement.consolidation
            (id, worker_id, week_start, week_end, gross_amount, deduction_amount, net_amount)
          SELECT gen_random_uuid(), worker_id, week_start, max(week_end),
                 sum(subtotal), 0, sum(subtotal)
            FROM montos
           GROUP BY worker_id, week_start
          RETURNING id, worker_id, week_start
        )
        INSERT INTO settlement.consolidation_detail
          (id, consolidation_id, requisition_id, hotel_id, catalog_position_id,
           regular_minutes, overtime_minutes, pay_rate_applied,
           overtime_multiplier_applied, is_internal_rate, subtotal)
        SELECT gen_random_uuid(), c.id, m.requisition_id, m.hotel_id, m.catalog_position_id,
               m.regular_minutes, m.overtime_minutes, m.pay_rate,
               m.ot_multiplier, m.is_internal, m.subtotal
          FROM montos m
          JOIN cabeza c ON c.worker_id = m.worker_id AND c.week_start = m.week_start
        RETURNING consolidation_id AS "id", (SELECT ''::text) AS "workerId"`

      const ids = [...new Set(created.map((r) => r.id))]

      for (const id of ids) {
        await tx.journalEntry.create({
          data: {
            id: uuidv7(),
            entityType: 'settlement.consolidation',
            entityId: id,
            eventType: 'CONSOLIDATION_GENERATED',
            actorUserId: params.userId,
            payload: { weekStart: day },
          },
        })
      }

      return ids.map((id) => ({ id, workerId: '' }))
    })
  }

  async byId(id: string): Promise<ConsolidationRow | null> {
    const rows = await this.prisma.$queryRaw<ConsolidationRow[]>`
      SELECT c.id,
             c.week_start        AS "weekStart",
             c.week_end          AS "weekEnd",
             c.status,
             c.gross_amount::text     AS "grossAmount",
             c.deduction_amount::text AS "deductionAmount",
             c.net_amount::text       AS "netAmount",
             c.validated_at  AS "validatedAt",
             c.authorized_at AS "authorizedAt",
             c.paid_at       AS "paidAt",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker
        FROM settlement.consolidation c
        JOIN personal.worker w ON w.id = c.worker_id
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
             c.gross_amount::text     AS "grossAmount",
             c.deduction_amount::text AS "deductionAmount",
             c.net_amount::text       AS "netAmount",
             c.validated_at  AS "validatedAt",
             c.authorized_at AS "authorizedAt",
             c.paid_at       AS "paidAt",
             jsonb_build_object('id', w.id, 'fullName', w.full_name) AS worker
        FROM settlement.consolidation c
        JOIN personal.worker w ON w.id = c.worker_id
       WHERE (${day}::date IS NULL OR c.week_start = ${day}::date)
         AND (${status}::text IS NULL OR c.status = ${status}::text)
       ORDER BY c.week_start DESC, w.full_name
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
