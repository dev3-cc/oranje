import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PermissionsService } from '../../identity/index.js'

import type { CreatePayAdjustmentDto } from './dto/create-pay-adjustment.dto.js'
import { PayAdjustmentRow, PayAdjustmentsRepository } from './pay-adjustments.repository.js'

export interface PayAdjustmentEntity {
  id: string
  assignmentId: string
  amount: string
  reason: string
  status: string
  payConcept: { id: string; code: string; name: string } | null
  requestedBy: { id: string; fullName: string }
  requestedAt: string
  approvedBy: { id: string; fullName: string } | null
  approvedAt: string | null
  rejectionReason: string | null
  worker: { id: string; fullName: string }
  hotelName: string
  requisitionNumber: string
}

/**
 * El ajuste de tarifa o el gasto extra (p. ej. «Uber») de una asignación
 * EVENTUAL (Hugo, 2026-10-08). Reclutamiento lo pide; el Observador —única
 * excepción a que es de puro lectura— lo aprueba o lo rechaza. Mientras está
 * PENDING no pesa en ningún cálculo de nómina.
 */
@Injectable()
export class PayAdjustmentsService {
  constructor(
    private readonly repo: PayAdjustmentsRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async create(
    assignmentId: string,
    dto: CreatePayAdjustmentDto,
    user: AuthenticatedUser,
  ): Promise<PayAdjustmentEntity> {
    const assignment = await this.repo.assignment(assignmentId)

    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'La asignación no existe',
      })
    }

    if (assignment.type !== 'TEMPORARY') {
      throw new UnprocessableEntityException({
        code: 'ASSIGNMENT_NOT_TEMPORARY',
        message: 'El ajuste o el gasto solo aplica a una asignación eventual',
      })
    }

    if (assignment.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_ACTIVE',
        message: 'Esta asignación ya no está activa',
      })
    }

    if (dto.payConceptId && !(await this.repo.payConceptExists(dto.payConceptId))) {
      throw new NotFoundException({
        code: 'PAY_CONCEPT_NOT_FOUND',
        message: 'Ese concepto de pago no existe',
      })
    }

    const row = await this.repo.create({
      assignmentId,
      payConceptId: dto.payConceptId ?? null,
      amount: dto.amount.toFixed(2),
      reason: dto.reason,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return toEntity(row)
  }

  /** Lo ve quien pide (Reclutamiento) o quien aprueba (Observador) — nadie más. */
  async byAssignment(assignmentId: string, user: AuthenticatedUser): Promise<PayAdjustmentEntity[]> {
    const allowed = await Promise.all([
      this.permissions.can(user.roleCode, 'requisitions', 'request_pay_adjustment'),
      this.permissions.can(user.roleCode, 'requisitions', 'approve_pay_adjustment'),
    ])
    if (!allowed.some(Boolean)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no puede ver los ajustes de pago de esta asignación',
      })
    }

    return (await this.repo.byAssignment(assignmentId)).map(toEntity)
  }

  async pending(): Promise<PayAdjustmentEntity[]> {
    return (await this.repo.pending()).map(toEntity)
  }

  async approve(id: string, user: AuthenticatedUser): Promise<PayAdjustmentEntity> {
    await this.pendingOrThrow(id)

    const row = await this.repo.resolve({
      id,
      status: 'APPROVED',
      rejectionReason: null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return toEntity(row)
  }

  async reject(id: string, reason: string, user: AuthenticatedUser): Promise<PayAdjustmentEntity> {
    await this.pendingOrThrow(id)

    const row = await this.repo.resolve({
      id,
      status: 'REJECTED',
      rejectionReason: reason,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return toEntity(row)
  }

  private async pendingOrThrow(id: string): Promise<void> {
    const row = await this.repo.byId(id)

    if (!row) {
      throw new NotFoundException({
        code: 'PAY_ADJUSTMENT_NOT_FOUND',
        message: 'Ese ajuste no existe',
      })
    }

    if (row.status !== 'PENDING') {
      throw new ConflictException({
        code: 'PAY_ADJUSTMENT_ALREADY_RESOLVED',
        message: 'Ese ajuste ya fue resuelto',
      })
    }
  }
}

function toEntity(row: PayAdjustmentRow): PayAdjustmentEntity {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    amount: row.amount,
    reason: row.reason,
    status: row.status,
    payConcept: row.payConcept,
    requestedBy: row.requestedByUser,
    requestedAt: row.requestedAt.toISOString(),
    approvedBy: row.approvedByUser,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    rejectionReason: row.rejectionReason,
    worker: row.worker,
    hotelName: row.hotelName,
    requisitionNumber: row.requisitionNumber,
  }
}
