import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
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
  updatedAt: Date | null
  hotel: { id: string; name: string }
  // Solo para resolver a quien avisar (el BD dueño del ciclo comercial);
  // no se expone en ContractEntity/toEntity.
  prospectId: string | null
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
         c.updated_at AS "updatedAt",
         c.prospect_id AS "prospectId",
         jsonb_build_object('id', h.id, 'name', h.name) AS hotel
    FROM commercial.contract c
    JOIN commercial.hotel h ON h.id = c.hotel_id`

@Injectable()
export class ContractsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Nombre y correo de quien manda el documento: firma el cuerpo y recibe el Reply-To. */
  async senderInfo(userId: string): Promise<{ fullName: string; email: string } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    })
  }

  /**
   * Lo que el contrato HEREDA del hotel: el cierre de semana y el recargo de
   * overtime pagado se capturan al dar de alta el hotel (Datos contables) y
   * ya no se vuelven a pedir aquí (Hugo, 2026-10-07). `null` en el hotel es
   * honesto en los que nacieron antes de esta captura.
   */
  async hotelAccounting(id: string): Promise<{
    weekStartDay: number | null
    weekEndDay: number | null
    overtimePayMultiplier: Prisma.Decimal | null
  } | null> {
    return this.prisma.hotel.findUnique({
      where: { id },
      select: { weekStartDay: true, weekEndDay: true, overtimePayMultiplier: true },
    })
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

  /**
   * Las posiciones que el contrato VIGENTE del hotel cotizó — para Requisición
   * (2026-10-17): solo se pide lo que el hotel ya contrató, no el catálogo
   * entero. `hotelDepartmentId` viaja porque fuera de Hospitality puede ser
   * nulo (la posición no tiene departamento de hotel) — la pantalla que
   * consume esto decide qué hacer con esas.
   */
  async contractedPositions(
    hotelId: string,
  ): Promise<Array<{ id: string; name: string; hotelDepartmentId: string | null }>> {
    return this.prisma.$queryRaw<
      Array<{ id: string; name: string; hotelDepartmentId: string | null }>
    >`
      SELECT p.id, p.name, p.hotel_department_id AS "hotelDepartmentId"
        FROM commercial.contract_rate r
        JOIN commercial.contract c ON c.id = r.contract_id
        JOIN catalogs."position" p ON p.id = r.catalog_position_id
       WHERE c.hotel_id = ${hotelId}::uuid AND c.status = 'ACTIVE'
       ORDER BY p.name`
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
        ON CONFLICT (contract_id, catalog_position_id)
        DO UPDATE SET pay_rate = EXCLUDED.pay_rate,
                      bill_rate = EXCLUDED.bill_rate,
                      updated_at = now()`

      // `contract.updated_at` SÍ se toca aquí, aunque la fila que cambió sea
      // `contract_rate` (Hugo, 2026-10-16): es lo que la vista previa de
      // pago compara contra `approvedAt` para avisar "esto cambió" — una
      // tarifa editada en un contrato ACTIVO es precisamente el caso real.
      await tx.$executeRaw`
        UPDATE commercial.contract SET updated_at = now() WHERE id = ${params.contractId}::uuid`

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

  async update(params: {
    id: string
    validTo: Date | null
    overtimeBillMultiplier: number
    holidayBillMultiplier: number
    holidayPayMultiplier: number
    deductsMeals: boolean
    splitsInvoiceByMonth: boolean
    changed: Prisma.InputJsonValue
    userId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: params.id },
        data: {
          validTo: params.validTo,
          overtimeBillMultiplier: params.overtimeBillMultiplier,
          holidayBillMultiplier: params.holidayBillMultiplier,
          holidayPayMultiplier: params.holidayPayMultiplier,
          deductsMeals: params.deductsMeals,
          splitsInvoiceByMonth: params.splitsInvoiceByMonth,
          updatedAt: new Date(),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'commercial.contract',
          entityId: params.id,
          eventType: 'CONTRACT_UPDATED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: params.changed,
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

  /** El BD dueño del ciclo comercial del que nació este contrato, si tiene uno vinculado. */
  async prospectOwner(prospectId: string): Promise<string | null> {
    const row = await this.prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { ownerUserId: true },
    })

    return row?.ownerUserId ?? null
  }
}
