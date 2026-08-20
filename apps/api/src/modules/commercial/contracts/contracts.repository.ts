import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface RateRow {
  id: string
  payRate: string
  billRate: string
  position: { id: string; code: string; name: string }
}

export interface ContractRow {
  id: string
  number: string
  status: string
  validFrom: Date
  validTo: Date | null
  weekStartDay: number
  weekEndDay: number
  overtimeBillMultiplier: string
  overtimePayMultiplier: string
  holidayBillMultiplier: string
  holidayPayMultiplier: string
  deductsMeals: boolean
  splitsInvoiceByMonth: boolean
  signedAt: Date | null
  createdAt: Date
  hotel: { id: string; name: string }
}

const BASE = `
  SELECT c.id,
         c.number,
         c.status,
         c.valid_from AS "validFrom",
         c.valid_to   AS "validTo",
         c.week_start_day AS "weekStartDay",
         c.week_end_day   AS "weekEndDay",
         c.overtime_bill_multiplier::text AS "overtimeBillMultiplier",
         c.overtime_pay_multiplier::text  AS "overtimePayMultiplier",
         c.holiday_bill_multiplier::text  AS "holidayBillMultiplier",
         c.holiday_pay_multiplier::text   AS "holidayPayMultiplier",
         c.deducts_meals AS "deductsMeals",
         c.splits_invoice_by_month AS "splitsInvoiceByMonth",
         c.signed_at  AS "signedAt",
         c.created_at AS "createdAt",
         jsonb_build_object('id', h.id, 'name', h.name) AS hotel
    FROM commercial.contract c
    JOIN commercial.hotel h ON h.id = c.hotel_id`

@Injectable()
export class ContractsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotelExists(id: string): Promise<boolean> {
    return (await this.prisma.hotel.count({ where: { id } })) > 0
  }

  async positionsExist(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.catalogPosition.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })

    return new Set(rows.map((r) => r.id))
  }

  async activeOf(hotelId: string): Promise<{ id: string; number: string } | null> {
    return this.prisma.contract.findFirst({
      where: { hotelId, status: 'ACTIVE' },
      select: { id: true, number: true },
    })
  }

  async byId(id: string): Promise<ContractRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<ContractRow[]>(
      `${BASE} WHERE c.id = $1::uuid`,
      id,
    )

    return rows[0] ?? null
  }

  async listAll(hotelId: string | null, status: string | null): Promise<ContractRow[]> {
    return this.prisma.$queryRawUnsafe<ContractRow[]>(
      `${BASE}
        WHERE ($1::uuid IS NULL OR c.hotel_id = $1::uuid)
          AND ($2::text IS NULL OR c.status = $2::text)
        ORDER BY c.valid_from DESC
        LIMIT 200`,
      hotelId,
      status,
    )
  }

  async rates(contractId: string): Promise<RateRow[]> {
    return this.prisma.$queryRaw<RateRow[]>`
      SELECT r.id,
             r.pay_rate::text  AS "payRate",
             r.bill_rate::text AS "billRate",
             jsonb_build_object('id', p.id, 'code', p.code, 'name', p.name) AS position
        FROM commercial.contract_rate r
        JOIN catalogs."position" p ON p.id = r.catalog_position_id
       WHERE r.contract_id = ${contractId}::uuid
       ORDER BY p.name`
  }

  async countRates(contractId: string): Promise<number> {
    return this.prisma.contractRate.count({ where: { contractId } })
  }

  async create(params: {
    number: string
    hotelId: string
    prospectId: string | null
    validFrom: Date
    validTo: Date | null
    weekStartDay: number
    weekEndDay: number
    overtimeBillMultiplier: number
    overtimePayMultiplier: number
    holidayBillMultiplier: number
    holidayPayMultiplier: number
    deductsMeals: boolean
    splitsInvoiceByMonth: boolean
    rates: Array<{ catalogPositionId: string; payRate: string; billRate: string }>
    userId: string
    roleCode: string
  }): Promise<string> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.contract.create({
        data: {
          id,
          number: params.number,
          hotelId: params.hotelId,
          prospectId: params.prospectId,
          validFrom: params.validFrom,
          validTo: params.validTo,
          weekStartDay: params.weekStartDay,
          weekEndDay: params.weekEndDay,
          overtimeBillMultiplier: params.overtimeBillMultiplier,
          overtimePayMultiplier: params.overtimePayMultiplier,
          holidayBillMultiplier: params.holidayBillMultiplier,
          holidayPayMultiplier: params.holidayPayMultiplier,
          deductsMeals: params.deductsMeals,
          splitsInvoiceByMonth: params.splitsInvoiceByMonth,
        },
      })

      for (const r of params.rates) {
        await tx.$executeRaw`
          INSERT INTO commercial.contract_rate
            (id, contract_id, catalog_position_id, pay_rate, bill_rate)
          VALUES (${uuidv7()}::uuid, ${id}::uuid, ${r.catalogPositionId}::uuid,
                  ${r.payRate}::numeric, ${r.billRate}::numeric)`
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.contract',
          entityId: id,
          eventType: 'CONTRACT_DRAFTED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { number: params.number, rates: params.rates.length },
        },
      })
    })

    return id
  }

  async upsertRate(params: {
    contractId: string
    catalogPositionId: string
    payRate: string
    billRate: string
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO commercial.contract_rate
          (id, contract_id, catalog_position_id, pay_rate, bill_rate)
        VALUES (${uuidv7()}::uuid, ${params.contractId}::uuid,
                ${params.catalogPositionId}::uuid,
                ${params.payRate}::numeric, ${params.billRate}::numeric)
        ON CONFLICT ON CONSTRAINT ux_contract_rate_position
        DO UPDATE SET pay_rate = EXCLUDED.pay_rate,
                      bill_rate = EXCLUDED.bill_rate,
                      updated_at = now()`

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.contract',
          entityId: params.contractId,
          eventType: 'CONTRACT_RATE_SET',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            catalogPositionId: params.catalogPositionId,
            payRate: params.payRate,
            billRate: params.billRate,
          },
        },
      })
    })
  }

  async setStatus(params: {
    id: string
    status: string
    sign: boolean
    userId: string
    roleCode: string
    event: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: params.id },
        data: {
          status: params.status,
          ...(params.sign ? { signedBy: params.userId, signedAt: new Date() } : {}),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.contract',
          entityId: params.id,
          eventType: params.event,
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { status: params.status },
        },
      })
    })
  }

  async numberTaken(number: string): Promise<boolean> {
    return (await this.prisma.contract.count({ where: { number } })) > 0
  }
}
