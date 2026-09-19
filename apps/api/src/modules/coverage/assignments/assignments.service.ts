import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { assignmentStatusLabel } from '../../../common/utils/status-labels.js'
import { PermissionsService } from '../../identity/index.js'
import { NotificationPublisherService } from '../../notifications/index.js'

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
    private readonly notifications: NotificationPublisherService,
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

    /*
     * Faltaba: quien tiene `hotelId` (todo el depto Hotel, vía `read_own`)
     * podía pedir las asignaciones de CUALQUIER requisición con solo conocer
     * su id — sin este filtro veía colaboradores de otro hotel. Mismo
     * criterio que `RequisitionsService.get()`.
     */
    const hotelId = await this.repo.requisitionHotelId(requisitionId)
    if (user.hotelId && hotelId !== null && hotelId !== user.hotelId) {
      throw new ForbiddenException({
        code: 'HOTEL_OUT_OF_SCOPE',
        message: 'Esta requisición no es de tu hotel',
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
    const startDate = dto.startDate ?? new Date()

    const row = await this.repo.assign({
      slotId: slot.id,
      workerId: dto.workerId,
      type: dto.type,
      startDate,
      endDate: dto.endDate ?? null,
      requisitionId: position.requisitionId,
      positionId: dto.positionId,
      coverageStateId: coverageState.id,
      requisitionStateId: requisitionState?.id ?? null,
      fromRequisitionStateId: position.requisitionStateId,
      userId: user.id,
      roleCode: user.roleCode,
    })

    // WORKER_ASSIGNED: avisa al colaborador de su nueva asignación.
    try {
      await this.notifications.publish({
        type: 'WORKER_ASSIGNED',
        title: 'Nueva asignación',
        body: `Tienes una nueva asignación a partir del ${startDate.toISOString().slice(0, 10)}.`,
        entity: { type: 'coverage.assignment', id: row.id },
        actorUserId: user.id,
        audience: [{ kind: 'WORKER', workerId: dto.workerId }],
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte la asignación.
    }

    // REQ_FULLY_COVERED: avisa al Supervisor y al Manager de Área de que la
    // requisición ya quedó cubierta al 100%.
    if (closes) {
      const audience = [position.requisitionCreatedBy, position.requisitionAreaManagerUserId]
        .filter((id): id is string => Boolean(id))
        .map((userId) => ({ kind: 'USER' as const, userId }))

      if (audience.length > 0) {
        try {
          await this.notifications.publish({
            type: 'REQ_FULLY_COVERED',
            title: 'Requisición cubierta al 100%',
            body: 'La requisición ya está cubierta al 100%.',
            entity: { type: 'demand.requisition', id: position.requisitionId },
            actorUserId: user.id,
            audience,
          })
        } catch {
          // Mejor esfuerzo: que Pub/Sub no responda no revierte la asignación.
        }
      }
    }

    return {
      assignment: toEntity(row),
      positionCoverage: coverage.positionCode,
      requisitionState: closes ? FULLY_COVERED : position.requisitionState,
    }
  }

  // Eliminar a alguien del Pool (Hugo, 2026-09-15) ya no se bloquea porque
  // siga trabajando: se libera cada asignación ACTIVA suya (puede tener más
  // de una — RR-05 solo prohíbe horas que chocan) antes de eliminarlo, cada
  // una con el mismo `release()` de siempre, así que la cobertura del slot se
  // recalcula igual que si alguien la hubiera soltado a mano.
  async releaseAllOf(workerId: string, reason: string, user: AuthenticatedUser): Promise<void> {
    const ids = await this.repo.activeAssignmentIdsOf(workerId)
    for (const id of ids) {
      await this.release(id, reason, user)
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
        message: `Esta asignación ya está ${assignmentStatusLabel(row.status)}`,
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

    // WORKER_TEMP_ENDED: solo la temporal se avisa — la fija termina cuando el
    // hotel manda a descansar al colaborador (Rosa), un aviso distinto.
    if (row.type === 'TEMPORARY') {
      try {
        await this.notifications.publish({
          type: 'WORKER_TEMP_ENDED',
          title: 'Asignación temporal terminada',
          body: `Tu asignación temporal terminó: ${reason}`.slice(0, 500),
          entity: { type: 'coverage.assignment', id },
          actorUserId: user.id,
          audience: [{ kind: 'WORKER', workerId: row.worker.id }],
        })
      } catch {
        // Mejor esfuerzo: que Pub/Sub no responda no revierte la liberación.
      }
    }

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
        message: 'Ese estado no existe en el semáforo',
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
