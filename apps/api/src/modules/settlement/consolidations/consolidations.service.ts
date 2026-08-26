import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import {
  ConsolidationRow,
  ConsolidationsRepository,
  DeductionRow,
  DetailRow,
} from './consolidations.repository.js'
import type { CreateDeductionDto, GenerateDto } from './dto/generate.dto.js'

const DRAFT = 'DRAFT'
const VALIDATED = 'VALIDATED'
const AUTHORIZED = 'AUTHORIZED'
const PAID = 'PAID'

export interface ConsolidationEntity {
  id: string
  worker: { id: string; fullName: string }
  weekStart: string
  weekEnd: string
  status: string
  grossAmount: string
  deductionAmount: string
  netAmount: string
  validatedAt: string | null
  authorizedAt: string | null
  paidAt: string | null
  details?: DetailRow[]
  deductions?: DeductionRow[]
}

// Lo que el colaborador ve de su pago. Ni pay rate, ni deducciones internas,
// ni facturacion: RR-C-05 se los niega, y por eso es un tipo aparte y no el
// ConsolidationEntity recortado.
export interface MyPayment {
  id: string
  weekStart: string
  weekEnd: string
  netAmount: string
  paidAt: string | null
  hotels: string[]
  hours: number
}

@Injectable()
export class ConsolidationsService {
  constructor(private readonly repo: ConsolidationsRepository) {}

  // Solo pagos ya liberados (RR-C-05): el que esta en curso no se le muestra.
  async mine(user: AuthenticatedUser): Promise<MyPayment[]> {
    const workerId = await this.repo.workerOfUser(user.id)

    if (workerId === null) {
      throw new NotFoundException({
        code: 'WORKER_NOT_LINKED',
        message: 'Tu cuenta no está ligada a un colaborador',
      })
    }

    return (await this.repo.paidOfWorker(workerId)).map((row) => ({
      id: row.id,
      weekStart: row.weekStart.toISOString().slice(0, 10),
      weekEnd: row.weekEnd.toISOString().slice(0, 10),
      netAmount: row.netAmount,
      paidAt: row.paidAt?.toISOString() ?? null,
      hotels: row.hotels,
      hours: Math.round((row.minutes / 60) * 100) / 100,
    }))
  }

  async generate(dto: GenerateDto, user: AuthenticatedUser): Promise<{ created: number }> {
    if (dto.weekStart.getUTCDay() !== 1) {
      throw new ConflictException({
        code: 'WEEK_MUST_START_MONDAY',
        message: 'La semana de nómina empieza en lunes',
      })
    }

    if ((await this.repo.pendingWeeks(dto.weekStart)) === 0) {
      throw new ConflictException({
        code: 'NO_APPROVED_HOURS',
        message: 'Esa semana no tiene un solo Timesheet aprobado',
      })
    }

    const created = await this.repo.generate({ weekStart: dto.weekStart, userId: user.id })

    return { created: created.length }
  }

  async list(weekStart?: Date, status?: string): Promise<ConsolidationEntity[]> {
    return (await this.repo.listAll(weekStart ?? null, status ?? null)).map(toEntity)
  }

  async get(id: string): Promise<ConsolidationEntity> {
    const row = await this.consolidation(id)

    return {
      ...toEntity(row),
      details: await this.repo.details(id),
      deductions: await this.repo.deductions(id),
    }
  }

  async addDeduction(
    id: string,
    dto: CreateDeductionDto,
    user: AuthenticatedUser,
  ): Promise<ConsolidationEntity> {
    const row = await this.consolidation(id)

    if (row.status !== DRAFT) {
      throw new ConflictException({
        code: 'CONSOLIDATION_NOT_DRAFT',
        message: `Ya no se tocan las deducciones: el consolidado está en ${row.status}`,
      })
    }

    await this.repo.addDeduction({
      consolidationId: id,
      type: dto.type,
      amount: dto.amount,
      sourceNote: dto.sourceNote ?? null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(id)
  }

  async validate(id: string, user: AuthenticatedUser): Promise<ConsolidationEntity> {
    await this.assertStatus(id, DRAFT, 'validar')

    await this.repo.setStatus({
      id,
      status: VALIDATED,
      column: 'validated',
      userId: user.id,
      roleCode: user.roleCode,
      event: 'CONSOLIDATION_VALIDATED',
    })

    return this.get(id)
  }

  async authorize(id: string, user: AuthenticatedUser): Promise<ConsolidationEntity> {
    await this.assertStatus(id, VALIDATED, 'autorizar')

    await this.repo.setStatus({
      id,
      status: AUTHORIZED,
      column: 'authorized',
      userId: user.id,
      roleCode: user.roleCode,
      event: 'CONSOLIDATION_AUTHORIZED',
    })

    return this.get(id)
  }

  async markPaid(id: string, user: AuthenticatedUser): Promise<ConsolidationEntity> {
    await this.assertStatus(id, AUTHORIZED, 'marcar como pagado')

    await this.repo.setStatus({
      id,
      status: PAID,
      column: 'paid',
      userId: user.id,
      roleCode: user.roleCode,
      event: 'CONSOLIDATION_PAID',
    })

    return this.get(id)
  }

  private async assertStatus(id: string, expected: string, action: string): Promise<void> {
    const row = await this.consolidation(id)

    if (row.status !== expected) {
      throw new ConflictException({
        code: 'CONSOLIDATION_WRONG_STATUS',
        message: `Para ${action} el consolidado debe estar en ${expected}, y está en ${row.status}`,
      })
    }
  }

  private async consolidation(id: string): Promise<ConsolidationRow> {
    const row = await this.repo.byId(id)

    if (!row) {
      throw new NotFoundException({
        code: 'CONSOLIDATION_NOT_FOUND',
        message: 'El consolidado no existe',
      })
    }

    return row
  }
}

function toEntity(row: ConsolidationRow): ConsolidationEntity {
  return {
    id: row.id,
    worker: row.worker,
    weekStart: new Date(row.weekStart).toISOString().slice(0, 10),
    weekEnd: new Date(row.weekEnd).toISOString().slice(0, 10),
    status: row.status,
    grossAmount: row.grossAmount,
    deductionAmount: row.deductionAmount,
    netAmount: row.netAmount,
    validatedAt: row.validatedAt ? new Date(row.validatedAt).toISOString() : null,
    authorizedAt: row.authorizedAt ? new Date(row.authorizedAt).toISOString() : null,
    paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
  }
}
