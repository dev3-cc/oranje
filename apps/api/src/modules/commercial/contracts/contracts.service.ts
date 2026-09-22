import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { contractStatusLabel } from '../../../common/utils/status-labels.js'
import { NotificationPublisherService } from '../../notifications/index.js'

import { ContractRow, ContractsRepository, RateRow } from './contracts.repository.js'
import type { CreateContractDto, UpsertRateDto } from './dto/contract.dto.js'

const DRAFT = 'DRAFT'
const ACTIVE = 'ACTIVE'
const EXPIRED = 'EXPIRED'
const CANCELLED = 'CANCELLED'

export interface ContractEntity {
  id: string
  number: string
  hotel: { id: string; name: string }
  status: string
  validFrom: string
  validTo: string | null
  week: { startDay: number; endDay: number }
  multipliers: {
    overtimeBill: string
    overtimePay: string
    holidayBill: string
    holidayPay: string
  }
  deductsMeals: boolean
  splitsInvoiceByMonth: boolean
  signedAt: string | null
  createdAt: string
  rates?: RateRow[]
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly repo: ContractsRepository,
    private readonly notifications: NotificationPublisherService,
  ) {}

  async create(dto: CreateContractDto, user: AuthenticatedUser): Promise<ContractEntity> {
    if (!(await this.repo.hotelExists(dto.hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    if (dto.validTo && dto.validTo <= dto.validFrom) {
      throw new UnprocessableEntityException({
        code: 'VALIDITY_BACKWARDS',
        message: 'La vigencia termina antes de empezar',
      })
    }

    if (dto.weekStartDay === dto.weekEndDay) {
      throw new UnprocessableEntityException({
        code: 'WEEK_INVALID',
        message: 'La semana no puede empezar y terminar el mismo día',
      })
    }

    this.assertMargins(dto)
    await this.assertPositions(dto)

    const id = await this.repo.create({
      number: await this.nextNumber(),
      hotelId: dto.hotelId,
      prospectId: dto.prospectId ?? null,
      validFrom: dto.validFrom,
      validTo: dto.validTo ?? null,
      weekStartDay: dto.weekStartDay,
      weekEndDay: dto.weekEndDay,
      overtimeBillMultiplier: dto.overtimeBillMultiplier,
      overtimePayMultiplier: dto.overtimePayMultiplier,
      holidayBillMultiplier: dto.holidayBillMultiplier,
      holidayPayMultiplier: dto.holidayPayMultiplier,
      deductsMeals: dto.deductsMeals,
      splitsInvoiceByMonth: dto.splitsInvoiceByMonth,
      rates: dto.rates,
      userId: user.id,
      roleCode: user.roleCode,
    })

    const result = await this.get(id)

    // SALES_TERMS_CREATED (catálogo de notificaciones): avisa al BDC —el
    // manager del BD dueño del ciclo comercial— que el Documento de T&C ya
    // se redactó. Este modelo no separa un documento de T&C aparte del
    // Contrato: la entidad hace ese papel para este evento (decisión
    // confirmada). El segundo salto (BD → su BDC) lo resuelve el propio
    // catálogo de audiencias con `MANAGER_OF`, igual que `reportsToUserId`
    // en RecipientsService — no se duplica esa consulta aquí.
    if (dto.prospectId) {
      try {
        const ownerUserId = await this.repo.prospectOwner(dto.prospectId)

        if (ownerUserId) {
          await this.notifications.publish({
            type: 'SALES_TERMS_CREATED',
            title: 'Documento de T&C creado',
            body: `Se creó el contrato para ${result.hotel.name}.`,
            entity: { type: 'commercial.contract', id },
            actorUserId: user.id,
            audience: [{ kind: 'MANAGER_OF', userId: ownerUserId }],
          })
        }
      } catch {
        // Mejor esfuerzo: que Pub/Sub no responda no revierte el alta.
      }
    }

    return result
  }

  async list(hotelId?: string, status?: string): Promise<ContractEntity[]> {
    return (await this.repo.listAll(hotelId ?? null, status ?? null)).map(toEntity)
  }

  /**
   * Solo el pago: lo que ve Reclutamiento al asignar un slot (Hugo,
   * 2026-09-22) es cuánto le pagan a la persona, no la factura al hotel — eso
   * es de Ventas. `null` es honesto en dos casos: el hotel no tiene contrato
   * activo, o el contrato no cotizó esa posición.
   */
  async positionPayRate(
    hotelId: string,
    catalogPositionId: string,
  ): Promise<{ payRate: string; contractNumber: string } | null> {
    const active = await this.repo.activeOf(hotelId)
    if (!active) return null

    const rates = await this.repo.rates(active.id)
    const rate = rates.find((r) => r.position.id === catalogPositionId)

    return rate ? { payRate: rate.payRate, contractNumber: active.number } : null
  }

  async get(id: string): Promise<ContractEntity> {
    const row = await this.contract(id)

    return { ...toEntity(row), rates: await this.repo.rates(id) }
  }

  async setRate(id: string, dto: UpsertRateDto, user: AuthenticatedUser): Promise<ContractEntity> {
    const row = await this.contract(id)

    if (row.status !== DRAFT) {
      throw new ConflictException({
        code: 'CONTRACT_NOT_DRAFT',
        message: `Las tarifas solo se tocan en borrador, y este contrato está ${contractStatusLabel(row.status)}`,
      })
    }

    if (Number(dto.billRate) < Number(dto.payRate)) {
      throw new UnprocessableEntityException({
        code: 'RATE_MARGIN_NEGATIVE',
        message: 'El bill rate no puede quedar por debajo del pay rate',
      })
    }

    await this.repo.upsertRate({
      contractId: id,
      catalogPositionId: dto.catalogPositionId,
      payRate: dto.payRate,
      billRate: dto.billRate,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(id)
  }

  async activate(id: string, user: AuthenticatedUser): Promise<ContractEntity> {
    const row = await this.contract(id)

    if (row.status !== DRAFT) {
      throw new ConflictException({
        code: 'CONTRACT_NOT_DRAFT',
        message: `Solo se activa un contrato en borrador, y este está ${contractStatusLabel(row.status)}`,
      })
    }

    if ((await this.repo.countRates(id)) === 0) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_WITHOUT_RATES',
        message: 'Un contrato sin tarifas no puede pagar ni facturar nada',
      })
    }

    const active = await this.repo.activeOf(row.hotel.id)

    if (active) {
      throw new ConflictException({
        code: 'CONTRACT_ALREADY_ACTIVE',
        message: `El hotel ya tiene el contrato ${active.number} vigente: renuévalo o cancélalo`,
        details: [{ field: 'contractId', value: active.id }],
      })
    }

    await this.repo.setStatus({
      id,
      status: ACTIVE,
      sign: true,
      userId: user.id,
      roleCode: user.roleCode,
      event: 'CONTRACT_ACTIVATED',
    })

    const result = await this.get(id)

    // SALES_TERMS_VALIDATED: no hay un paso de "solo validar" separado de
    // activar —activar ES el acto de validación más cercano que existe—,
    // así que el aviso sale aquí. Audiencia: el BD dueño del ciclo
    // comercial original. Un contrato sin prospecto vinculado (heredado o
    // migrado, ver el comentario de `prospect_id` en el schema) no tiene un
    // BD que derivar y se omite sin inventar audiencia.
    if (row.prospectId) {
      try {
        await this.notifications.publish({
          type: 'SALES_TERMS_VALIDATED',
          title: 'T&C validado',
          body: `El contrato de ${result.hotel.name} ya está activo.`,
          entity: { type: 'commercial.contract', id },
          actorUserId: user.id,
          audience: [{ kind: 'PROSPECT_OWNER', prospectId: row.prospectId }],
        })
      } catch {
        // Mejor esfuerzo: que Pub/Sub no responda no revierte la activación.
      }
    }

    return result
  }

  async close(id: string, expired: boolean, user: AuthenticatedUser): Promise<ContractEntity> {
    const row = await this.contract(id)
    const target = expired ? EXPIRED : CANCELLED

    if (expired && row.status !== ACTIVE) {
      throw new ConflictException({
        code: 'CONTRACT_NOT_ACTIVE',
        message: `Solo expira un contrato vigente, y este está ${contractStatusLabel(row.status)}`,
      })
    }

    if (!expired && ![DRAFT, ACTIVE].includes(row.status)) {
      throw new ConflictException({
        code: 'CONTRACT_ALREADY_CLOSED',
        message: `Este contrato ya está ${contractStatusLabel(row.status)}`,
      })
    }

    await this.repo.setStatus({
      id,
      status: target,
      sign: false,
      userId: user.id,
      roleCode: user.roleCode,
      event: expired ? 'CONTRACT_EXPIRED' : 'CONTRACT_CANCELLED',
    })

    return this.get(id)
  }

  private assertMargins(dto: CreateContractDto): void {
    if (dto.overtimeBillMultiplier < dto.overtimePayMultiplier) {
      throw new UnprocessableEntityException({
        code: 'OVERTIME_MARGIN_NEGATIVE',
        message: 'El hotel no puede pagar menos recargo de overtime que el colaborador',
      })
    }

    if (dto.holidayBillMultiplier < dto.holidayPayMultiplier) {
      throw new UnprocessableEntityException({
        code: 'HOLIDAY_MARGIN_NEGATIVE',
        message: 'El hotel no puede pagar menos recargo de festivo que el colaborador',
      })
    }

    const backwards = dto.rates.find((r) => Number(r.billRate) < Number(r.payRate))

    if (backwards) {
      throw new UnprocessableEntityException({
        code: 'RATE_MARGIN_NEGATIVE',
        message: 'Hay una posición donde el bill rate queda por debajo del pay rate',
        details: [{ field: 'catalogPositionId', value: backwards.catalogPositionId }],
      })
    }
  }

  private async assertPositions(dto: CreateContractDto): Promise<void> {
    const ids = dto.rates.map((r) => r.catalogPositionId)
    const found = await this.repo.positionsExist(ids)
    const missing = ids.find((id) => !found.has(id))

    if (missing) {
      throw new UnprocessableEntityException({
        code: 'POSITION_NOT_FOUND',
        message: 'Una de las tarifas apunta a una posición que no existe',
        details: [{ field: 'catalogPositionId', value: missing }],
      })
    }

    if (new Set(ids).size !== ids.length) {
      throw new UnprocessableEntityException({
        code: 'RATE_DUPLICATED',
        message: 'Hay dos tarifas para la misma posición',
      })
    }
  }

  private async nextNumber(): Promise<string> {
    const year = new Date().getUTCFullYear()

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `CT-${year}-${String(Math.floor(Math.random() * 100_000)).padStart(5, '0')}`

      if (!(await this.repo.numberTaken(candidate))) {
        return candidate
      }
    }

    throw new ConflictException({
      code: 'NUMBER_COLLISION',
      message: 'No se pudo generar un número de contrato libre',
    })
  }

  private async contract(id: string): Promise<ContractRow> {
    const row = await this.repo.byId(id)

    if (!row) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'El contrato no existe' })
    }

    return row
  }
}

function toEntity(row: ContractRow): ContractEntity {
  return {
    id: row.id,
    number: row.number,
    hotel: row.hotel,
    status: row.status,
    validFrom: new Date(row.validFrom).toISOString().slice(0, 10),
    validTo: row.validTo ? new Date(row.validTo).toISOString().slice(0, 10) : null,
    week: { startDay: row.weekStartDay, endDay: row.weekEndDay },
    multipliers: {
      overtimeBill: row.overtimeBillMultiplier,
      overtimePay: row.overtimePayMultiplier,
      holidayBill: row.holidayBillMultiplier,
      holidayPay: row.holidayPayMultiplier,
    },
    deductsMeals: row.deductsMeals,
    splitsInvoiceByMonth: row.splitsInvoiceByMonth,
    signedAt: row.signedAt ? new Date(row.signedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
  }
}
