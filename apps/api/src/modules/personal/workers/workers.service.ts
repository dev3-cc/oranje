import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { StorageService } from '../../../infra/storage/index.js'
import { PermissionsService } from '../../identity/index.js'

import type {
  ChangeStateDto,
  CreateWorkerDto,
  QueryWorkersDto,
  UpdateWorkerDto,
} from './dto/create-worker.dto.js'
import type { WorkerEntity } from './entities/worker.entity.js'
import { WorkerRow, WorkersRepository } from './workers.repository.js'

const PENDING_VALIDATION = 'WHITE'
const AVAILABLE = 'STRONG_GREEN'
const MIN_AGE = 18

export interface WorkerBoard {
  data: WorkerEntity[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface TransitionOption {
  toState: string
  requiresReason: boolean
}

@Injectable()
export class WorkersService {
  constructor(
    private readonly repo: WorkersRepository,
    private readonly storage: StorageService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(dto: CreateWorkerDto, user: AuthenticatedUser): Promise<WorkerEntity> {
    const age = yearsSince(dto.birthDate)

    if (age < MIN_AGE) {
      throw new UnprocessableEntityException({
        code: 'WORKER_UNDERAGE',
        message: `El colaborador tiene ${age} años y el mínimo es ${MIN_AGE}`,
      })
    }

    const state = await this.stateOf(PENDING_VALIDATION)

    const id = await this.repo.create({
      fullName: dto.fullName,
      birthDate: dto.birthDate,
      gender: dto.gender,
      phone: dto.phone,
      address: dto.address,
      photoPath: dto.photoPath ?? null,
      zoneId: dto.zoneId,
      catalogPositionId: dto.catalogPositionId ?? null,
      hiringModalityId: dto.hiringModalityId ?? null,
      englishLevelId: dto.englishLevelId ?? null,
      experienceLevel: dto.experienceLevel ?? null,
      stateId: state.id,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(id)
  }

  /**
   * Dos lectores distintos, dos alcances (por eso la ruta no lleva
   * `@Requires`): Reclutamiento (`recruitment:search_candidates`) ve el Pool
   * completo; los roles del hotel (`staff:read`, «Ver colaboradores
   * asignados» — Mi Personal) ven SOLO a quien tiene una asignación activa en
   * su hotel. El permiso existía sembrado desde la Matriz de Hotel y ningún
   * endpoint lo pedía — media función, como las que documentó D-32.
   */
  async list(query: QueryWorkersDto, user: AuthenticatedUser): Promise<WorkerBoard> {
    const seesPool = await this.permissions.can(user.roleCode, 'recruitment', 'search_candidates')
    let assignedToHotelId: string | null = null

    if (!seesPool) {
      const seesStaff = await this.permissions.can(user.roleCode, 'staff', 'read')
      if (!seesStaff || !user.hotelId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Tu rol no puede listar colaboradores',
        })
      }
      assignedToHotelId = user.hotelId
    }

    const { rows, total } = await this.repo.findMany(query, assignedToHotelId)

    const photos = await this.signPhotos(rows)

    return {
      data: rows.map((row) => toEntity(row, photos)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async get(id: string): Promise<WorkerEntity> {
    const row = await this.worker(id)

    return toEntity(row, await this.signPhotos([row]))
  }

  // Se firman las rutas distintas, no una por fila: la misma foto en dos filas
  // se firma una vez.
  private async signPhotos(rows: WorkerRow[]): Promise<Map<string, string>> {
    const paths = [...new Set(rows.flatMap((row) => (row.photoPath ? [row.photoPath] : [])))]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))

    return new Map(paths.map((path, index) => [path, urls[index] as string]))
  }

  async update(id: string, dto: UpdateWorkerDto, user: AuthenticatedUser): Promise<WorkerEntity> {
    await this.worker(id)

    await this.repo.update({
      id,
      data: Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)),
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(id)
  }

  async available(id: string, user: AuthenticatedUser): Promise<TransitionOption[]> {
    const current = await this.stateOfWorker(id)
    const steps = await this.repo.allowedFrom(current.stateId)

    return steps
      .filter((s) => s.code !== null && (s.roleCode === null || s.roleCode === user.roleCode))
      .map((s) => ({ toState: s.code as string, requiresReason: s.requiresReason }))
  }

  async changeState(
    id: string,
    dto: ChangeStateDto,
    user: AuthenticatedUser,
  ): Promise<WorkerEntity> {
    const worker = await this.worker(id)
    const current = await this.stateOfWorker(id)
    const steps = await this.repo.allowedFrom(current.stateId)
    const candidates = steps.filter((s) => s.code === dto.toState)

    if (candidates.length === 0) {
      throw new ConflictException({
        code: 'TRANSITION_NOT_ALLOWED',
        message: `No se puede pasar de ${current.code} a ${dto.toState}`,
        details: [...new Set(steps.map((s) => s.code).filter(Boolean))].map((code) => ({
          field: 'toState',
          value: code as string,
        })),
      })
    }

    const step = candidates.find((s) => s.roleCode === null || s.roleCode === user.roleCode)

    if (!step) {
      throw new ForbiddenException({
        code: 'TRANSITION_FORBIDDEN',
        message: `Tu rol no puede pasar este colaborador a ${dto.toState}`,
        details: candidates
          .filter((c) => c.roleCode !== null)
          .map((c) => ({ field: 'authorizedRole', value: c.roleCode as string })),
      })
    }

    if (dto.toState === AVAILABLE && !worker.isProfileComplete) {
      throw new UnprocessableEntityException({
        code: 'PROFILE_INCOMPLETE',
        message: 'El expediente está a medias: no se puede validar al colaborador',
      })
    }

    let reasonId: string | null = null

    if (step.requiresReason) {
      if (!dto.reasonCode) {
        throw new UnprocessableEntityException({
          code: 'REASON_REQUIRED',
          message: `Pasar a ${dto.toState} exige un motivo`,
        })
      }

      const reason = await this.repo.reasonByCode(dto.reasonCode)

      if (!reason) {
        throw new UnprocessableEntityException({
          code: 'REASON_NOT_FOUND',
          message: `El motivo ${dto.reasonCode} no existe en el Semáforo del Colaborador`,
        })
      }

      reasonId = reason.id
    }

    if (!step.toStateId) {
      throw new ConflictException({
        code: 'TARGET_STATE_UNKNOWN',
        message: 'Esa transición no tiene destino fijo',
      })
    }

    await this.repo.changeState({
      id,
      fromStateId: current.stateId,
      toStateId: step.toStateId,
      toStateCode: dto.toState,
      reasonId,
      note: dto.note ?? null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(id)
  }

  async history(id: string): Promise<
    Array<{
      id: string
      fromState: string | null
      toState: string
      reason: string | null
      occurredAt: string
      userName: string
    }>
  > {
    await this.worker(id)

    return (await this.repo.history(id)).map((h) => ({
      ...h,
      occurredAt: h.occurredAt.toISOString(),
    }))
  }

  private async stateOf(code: string): Promise<{ id: string }> {
    const state = await this.repo.stateByCode(code)

    if (!state) {
      throw new ConflictException({
        code: 'STATE_NOT_FOUND',
        message: `El estado ${code} no existe en el Semáforo del Colaborador`,
      })
    }

    return state
  }

  private async stateOfWorker(id: string): Promise<{ stateId: string; code: string }> {
    const row = await this.repo.currentStateId(id)

    if (!row) {
      throw new NotFoundException({
        code: 'WORKER_NOT_FOUND',
        message: 'El colaborador no existe',
      })
    }

    return row
  }

  private async worker(id: string): Promise<WorkerRow> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({
        code: 'WORKER_NOT_FOUND',
        message: 'El colaborador no existe',
      })
    }

    return row
  }
}

function yearsSince(date: Date): number {
  const now = new Date()
  let years = now.getUTCFullYear() - date.getUTCFullYear()
  const month = now.getUTCMonth() - date.getUTCMonth()

  if (month < 0 || (month === 0 && now.getUTCDate() < date.getUTCDate())) {
    years -= 1
  }

  return years
}

function toEntity(row: WorkerRow, photos: Map<string, string>): WorkerEntity {
  return {
    id: row.id,
    fullName: row.fullName,
    birthDate: new Date(row.birthDate).toISOString().slice(0, 10),
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    address: row.address,
    photoUrl: row.photoPath ? (photos.get(row.photoPath) ?? null) : null,
    zone: row.zone,
    position: row.position,
    englishLevel: row.englishLevel,
    hiringModality: row.hiringModality,
    experienceLevel: row.experienceLevel,
    transportType: row.transportType,
    emergencyContact:
      row.emergencyContactName && row.emergencyContactPhone && row.emergencyContactRelationship
        ? {
            name: row.emergencyContactName,
            phone: row.emergencyContactPhone,
            relationship: row.emergencyContactRelationship,
          }
        : null,
    bloodType: row.bloodType,
    state: row.state,
    isProfileComplete: row.isProfileComplete,
    hasTaxId: row.hasTaxId,
    hasAccount: row.hasAccount,
    isBlacklisted: row.isBlacklisted,
    createdAt: new Date(row.createdAt).toISOString(),
  }
}
