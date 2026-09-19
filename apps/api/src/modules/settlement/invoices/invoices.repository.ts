import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface InvoiceRow {
  id: string
  folio: string
  status: string
  periodStart: Date
  periodEnd: Date
  totalAmount: string
  creditAmount: string
  approvedAt: Date | null
  createdAt: Date
  hotel: { id: string; name: string }
}

export interface InvoiceDetailRow {
  id: string
  workerName: string
  positionName: string
  regularMinutes: number
  overtimeMinutes: number
  billRateApplied: string
  overtimeMultiplierApplied: string
  subtotal: string
}

const BASE = `
  SELECT i.id,
         i.folio,
         i.status,
         i.period_start AS "periodStart",
         i.period_end   AS "periodEnd",
         i.total_amount::text  AS "totalAmount",
         i.credit_amount::text AS "creditAmount",
         i.approved_at AS "approvedAt",
         i.created_at  AS "createdAt",
         jsonb_build_object('id', h.id, 'name', h.name) AS hotel
    FROM settlement.invoice i
    JOIN commercial.hotel h ON h.id = i.hotel_id`

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotelExists(id: string): Promise<boolean> {
    return (await this.prisma.hotel.count({ where: { id } })) > 0
  }

  async existsForPeriod(
    hotelId: string,
    start: Date,
    end: Date,
  ): Promise<{ folio: string } | null> {
    return this.prisma.invoice.findFirst({
      where: { hotelId, periodStart: start, periodEnd: end },
      select: { folio: true },
    })
  }

  async approvedHours(hotelId: string, start: Date, end: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT count(*) AS total
        FROM operations.timesheet t
        JOIN demand.requisition r ON r.id = t.requisition_id
       WHERE r.hotel_id = ${hotelId}::uuid
         AND t.status = 'APPROVED'
         AND t.week_start >= ${start.toISOString().slice(0, 10)}::date
         AND t.week_end   <= ${end.toISOString().slice(0, 10)}::date`

    return Number(rows[0]?.total ?? 0)
  }

  async generate(params: {
    folio: string
    hotelId: string
    periodStart: Date
    periodEnd: Date
    userId: string
    roleCode: string
  }): Promise<string | null> {
    const start = params.periodStart.toISOString().slice(0, 10)
    const end = params.periodEnd.toISOString().slice(0, 10)

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.$queryRaw<Array<{ id: string }>>`
        WITH horas AS (
          SELECT t.worker_id,
                 t.requisition_id,
                 p.catalog_position_id,
                 sum(v.net_minutes)::int      AS regular_minutes,
                 sum(d.overtime_minutes)::int AS overtime_minutes
            FROM operations.timesheet t
            JOIN operations.timesheet_day d    ON d.timesheet_id = t.id
            JOIN operations.vw_timesheet_day v ON v.id = d.id
            JOIN demand.requisition r          ON r.id = t.requisition_id
            JOIN demand."position" p           ON p.requisition_id = r.id AND p.deleted_at IS NULL
           WHERE r.hotel_id = ${params.hotelId}::uuid
             AND t.status = 'APPROVED'
             AND t.week_start >= ${start}::date
             AND t.week_end   <= ${end}::date
           GROUP BY t.worker_id, t.requisition_id, p.catalog_position_id
        ),
        tarifas AS (
          SELECT h.*,
                 cr.bill_rate,
                 COALESCE(ct.overtime_bill_multiplier, 1.5) AS ot_multiplier
            FROM horas h
            JOIN commercial.contract ct
              ON ct.hotel_id = ${params.hotelId}::uuid AND ct.status = 'ACTIVE'
            JOIN commercial.contract_rate cr
              ON cr.contract_id = ct.id AND cr.catalog_position_id = h.catalog_position_id
        ),
        montos AS (
          SELECT *,
                 round(
                   (regular_minutes  / 60.0) * bill_rate
                 + (overtime_minutes / 60.0) * bill_rate * ot_multiplier
                 , 2) AS subtotal
            FROM tarifas
        ),
        cabeza AS (
          INSERT INTO settlement.invoice
            (id, hotel_id, folio, period_start, period_end, total_amount, credit_amount)
          SELECT ${uuidv7()}::uuid, ${params.hotelId}::uuid, ${params.folio},
                 ${start}::date, ${end}::date, sum(subtotal), 0
            FROM montos
           HAVING count(*) > 0
          RETURNING id
        )
        INSERT INTO settlement.invoice_detail
          (id, invoice_id, requisition_id, worker_id, catalog_position_id,
           regular_minutes, overtime_minutes, bill_rate_applied,
           overtime_multiplier_applied, subtotal)
        SELECT gen_random_uuid(), c.id, m.requisition_id, m.worker_id, m.catalog_position_id,
               m.regular_minutes, m.overtime_minutes, m.bill_rate,
               m.ot_multiplier, m.subtotal
          FROM montos m CROSS JOIN cabeza c
        RETURNING invoice_id AS id`

      const id = created[0]?.id ?? null

      if (id) {
        await tx.journalEntry.create({
          data: {
            id: uuidv7(),
            entityType: 'settlement.invoice',
            entityId: id,
            eventType: 'INVOICE_GENERATED',
            actorUserId: params.userId,
            actorRole: params.roleCode,
            payload: { folio: params.folio, periodStart: start, periodEnd: end },
          },
        })
      }

      return id
    })
  }

  async byId(id: string): Promise<InvoiceRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<InvoiceRow[]>(
      `${BASE} WHERE i.id = $1::uuid`,
      id,
    )

    return rows[0] ?? null
  }

  async listAll(hotelId: string | null, status: string | null): Promise<InvoiceRow[]> {
    return this.prisma.$queryRawUnsafe<InvoiceRow[]>(
      `${BASE}
        WHERE ($1::uuid IS NULL OR i.hotel_id = $1::uuid)
          AND ($2::text IS NULL OR i.status = $2::text)
        ORDER BY i.period_start DESC
        LIMIT 200`,
      hotelId,
      status,
    )
  }

  async details(invoiceId: string): Promise<InvoiceDetailRow[]> {
    return this.prisma.$queryRaw<InvoiceDetailRow[]>`
      SELECT d.id,
             w.full_name AS "workerName",
             p.name      AS "positionName",
             d.regular_minutes  AS "regularMinutes",
             d.overtime_minutes AS "overtimeMinutes",
             d.bill_rate_applied::text            AS "billRateApplied",
             d.overtime_multiplier_applied::text  AS "overtimeMultiplierApplied",
             d.subtotal::text                     AS subtotal
        FROM settlement.invoice_detail d
        JOIN personal.worker w     ON w.id = d.worker_id
        JOIN catalogs."position" p ON p.id = d.catalog_position_id
       WHERE d.invoice_id = ${invoiceId}::uuid
       ORDER BY w.full_name`
  }

  async addCredit(params: {
    id: string
    amount: string
    note: string
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE settlement.invoice
           SET credit_amount = credit_amount + ${params.amount}::numeric,
               updated_at = now()
         WHERE id = ${params.id}::uuid`

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'settlement.invoice',
          entityId: params.id,
          eventType: 'INVOICE_CREDITED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { amount: params.amount, note: params.note },
        },
      })
    })
  }

  async setStatus(params: {
    id: string
    status: string
    approve: boolean
    userId: string
    roleCode: string
    event: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: params.id },
        data: {
          status: params.status,
          ...(params.approve ? { approvedBy: params.userId, approvedAt: new Date() } : {}),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'settlement.invoice',
          entityId: params.id,
          eventType: params.event,
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { status: params.status },
        },
      })
    })
  }

  async folioTaken(folio: string): Promise<boolean> {
    return (await this.prisma.invoice.count({ where: { folio } })) > 0
  }
}
