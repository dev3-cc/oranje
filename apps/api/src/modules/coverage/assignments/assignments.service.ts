import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PermissionsService } from '../../identity/index.js'

import {
  AssignmentRow,
  AssignmentsRepository,
  COVERAGE_LIGHT,
  REQUISITION_LIGHT,
} from './assignments.repository.js'
import type { CreateAssignmentDto } from './dto/create-assignment.dto.js'

const IN_PROGRESS = 'YELLOW'
const FULLY_COVERED = 'LIGHT_BLUE'
const PARTIALLY_COVERED = 'RED'
const CLOSED_STATES = [FULLY_COVERED, PARTIALLY_COVERED]

const COVERED = 'GREEN'
const ALMOST = 'YELLOW'
const SHORT = 'RED'

const ALMOST_THRESHOLD = 0.25

export interface AssignmentEntity {
  id: string
  type: string
  status: string
  worker: { id: string; fullName: string }
  slot: { id: string; ordinal: number }
  createdAt: string
}

export interface AssignmentResult {
  assignment: AssignmentEntity
  positionCoverage: string
  requisitionState: string
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly repo: AssignmentsRepository,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Leer asignaciones acepta los mismos tres permisos que leer la requisición
   * (`read_own` del Hotel, `read_all` y `read_authorized_queue` de
   * Reclutamiento): el tablero de slots del Self-Pick vive de esta lista.
   */
  async list(requisitionId: string, user: AuthenticatedUser): Promise<AssignmentEntity[]> {
    const allowed = await Promise.all([
      this.permissions.can(user.roleCode, 'requisitions', 'read_own'),
      this.permissions.can(user.roleCode, 'requisitions', 'read_all'),
      this.permissions.can(user.roleCode, 'requisitions', 'read_authorized_queue'),
    ])
    if (!allowed.some(Boolean)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no puede leer asignaciones',
      })
    }

    return (await this.repo.listByRequisition(requisitionId)).map(toEntity)
  }

  async create(dto: CreateAssignmentDto, user: AuthenticatedUser): Promise<AssignmentResult> {
    const position = await this.repo.position(dto.positionId)

    if (!position || position.deletedAt !== null) {
      throw new NotFoundException({
        code: 'POSITION_NOT_FOUND',
        message: 'La posición no existe',
      })
    }

    if (position.requisitionState !== IN_PROGRESS) {
      throw new ConflictException({
        code: 'REQUISITION_NOT_IN_PROGRESS',
        message: `Toma la requisición antes de asignar: está en ${position.requisitionState}`,
      })
    }

    const worker = await this.repo.worker(dto.workerId)

    if (!worker || worker.deletedAt !== null) {
      throw new NotFoundException({
        code: 'WORKER_NOT_FOUND',
        message: 'El colaborador no existe',
      })
    }

    if (await this.repo.activeAssignmentOf(dto.workerId)) {
      throw new ConflictException({
        code: 'WORKER_ALREADY_ASSIGNED',
        message: `${worker.fullName} ya tiene una asignación activa`,
      })
    }

    const slot = await this.repo.freeSlot(dto.positionId)

    if (!slot) {
      throw new UnprocessableEntityException({
        code: 'POSITION_FULL',
        message: 'Esta posición ya no tiene lugares libres',
      })
    }

    const coverage = await this.coverageAfter(position.requisitionId, dto.positionId, 1)
    const coverageState = await this.stateOf(COVERAGE_LIGHT, coverage.positionCode)

    const closes = coverage.allCovered && position.requisitionState === IN_PROGRESS
    const requisitionState = closes ? await this.stateOf(REQUISITION_LIGHT, FULLY_COVERED) : null

    const row = await this.repo.assign({
      slotId: slot.id,
      workerId: dto.workerId,
      type: dto.type,
      startDate: dto.startDate ?? new Date(),
      endDate: dto.endDate ?? null,
      requisitionId: position.requisitionId,
      positionId: dto.positionId,
      coverageStateId: coverageState.id,
      requisitionStateId: requisitionState?.id ?? null,
      fromRequisitionStateId: position.requisitionStateId,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return {
      assignment: toEntity(row),
      positionCoverage: coverage.positionCode,
      requisitionState: closes ? FULLY_COVERED : position.requisitionState,
    }
  }

  async release(id: string, reason: string, user: AuthenticatedUser): Promise<AssignmentEntity> {
    const row = await this.repo.byId(id)

    if (!row) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'La asignación no existe',
      })
    }

    if (row.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'ASSIGNMENT_NOT_ACTIVE',
        message: `Esta asignación está en ${row.status}`,
      })
    }

    const position = await this.repo.position(row.slot.positionId)

    if (!position) {
      throw new NotFoundException({
        code: 'POSITION_NOT_FOUND',
        message: 'La posición no existe',
      })
    }

    if (CLOSED_STATES.includes(position.requisitionState)) {
      throw new ConflictException({
        code: 'REQUISITION_CLOSED',
        message: `La requisición cerró en ${position.requisitionState} y no vuelve a abrirse`,
      })
    }

    const coverage = await this.coverageAfter(position.requisitionId, row.slot.positionId, -1)
    const coverageState = await this.stateOf(COVERAGE_LIGHT, coverage.positionCode)

    await this.repo.release({
      assignmentId: id,
      slotId: row.slot.id,
      positionId: row.slot.positionId,
      coverageStateId: coverageState.id,
      reason,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return toEntity({ ...row, status: 'CANCELLED' })
  }

  private async coverageAfter(
    requisitionId: string,
    positionId: string,
    delta: number,
  ): Promise<{ positionCode: string; allCovered: boolean }> {
    const positions = await this.repo.coverageOf(requisitionId)

    const projected = positions.map((p) => ({
      ...p,
      taken: p.positionId === positionId ? p.taken + delta : p.taken,
    }))

    const mine = projected.find((p) => p.positionId === positionId)

    return {
      positionCode: coverageCode(mine?.taken ?? 0, mine?.quantity ?? 0),
      allCovered: projected.every((p) => p.taken >= p.quantity),
    }
  }

  private async stateOf(light: string, code: string): Promise<{ id: string }> {
    const state = await this.repo.stateByCode(light, code)

    if (!state) {
      throw new ConflictException({
        code: 'STATE_NOT_FOUND',
        message: `El estado ${code} no existe en el semáforo ${light}`,
      })
    }

    return state
  }
}

export function coverageCode(taken: number, quantity: number): string {
  if (quantity === 0 || taken >= quantity) {
    return COVERED
  }

  const missing = (quantity - taken) / quantity

  return missing <= ALMOST_THRESHOLD ? ALMOST : SHORT
}

function toEntity(row: AssignmentRow): AssignmentEntity {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    worker: row.worker,
    slot: { id: row.slot.id, ordinal: row.slot.ordinal },
    createdAt: row.createdAt.toISOString(),
  }
}
