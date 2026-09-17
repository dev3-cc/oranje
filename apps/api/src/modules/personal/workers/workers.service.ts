import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { workerStateLabel } from '../../../common/utils/status-labels.js'
import { StorageService } from '../../../infra/storage/index.js'
import { PermissionsService } from '../../identity/index.js'
import { NotificationPublisherService } from '../../notifications/index.js'
import type { NotificationEvent } from '../../notifications/index.js'

import type {
  ChangeStateDto,
  CreateWorkerDto,
  QueryWorkersDto,
  UpdateWorkerDto,
} from './dto/create-worker.dto.js'
import type { WorkerEntity } from './entities/worker.entity.js'
import { WorkerRow, WorkersRepository } from './workers.repository.js'

const PENDING_VALIDATION = 'WHITE'
/** Días que gana el colaborador para completar el expediente si se le validó a medias. */
export const PROFILE_GRACE_DAYS = 3
const AVAILABLE = 'STRONG_GREEN'
const STANDBY = 'PINK'
const REPORTED = 'RED'
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
    private readonly notifications: NotificationPublisherService,
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
      transportType: dto.transportType ?? null,
      emergencyContactName: dto.emergencyContactName ?? null,
      emergencyContactPhone: dto.emergencyContactPhone ?? null,
      emergencyContactRelationship: dto.emergencyContactRelationship ?? null,
      bloodType: dto.bloodType ?? null,
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

  /**
   * Reclutamiento ve la ficha completa; los roles de Hotel la ven de QUIEN
   * TIENEN ASIGNADO —`staff:read_history`, «Ver Expediente» desde Mi Personal—.
   *
   * Sin `@Requires` en la ruta: dos permisos válidos con alcances distintos, el
   * mismo patrón que requisiciones y territorio.
   */
  async getScoped(id: string, user: AuthenticatedUser): Promise<WorkerEntity> {
    await this.assertCanSee(id, user)

    return this.get(id)
  }

  /**
   * `staff:set_standby` abre PINK; `staff:report` abre RED («Reportar
   * colaborador») — dos permisos, dos destinos. Antes solo se comprobaba
   * `set_standby` y CUALQUIER `toState` que no fuera PINK caía en
   * `ONLY_STANDBY`, así que `staff:report` estaba sembrado (Reglas de Negocio,
   * D-18) y con transición real en el semáforo (`WORKER_OPERATIONAL → RED`,
   * seed.ts) pero el servicio nunca lo consultaba: ni con el permiso hecho el
   * botón habría funcionado.
   */
  private async assertCanChangeState(
    id: string,
    toState: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (await this.permissions.can(user.roleCode, 'recruitment', 'validate_signup')) {
      return
    }

    const [canStandby, canReport] = await Promise.all([
      this.permissions.can(user.roleCode, 'staff', 'set_standby'),
      this.permissions.can(user.roleCode, 'staff', 'report'),
    ])

    if (!canStandby && !canReport) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no puede cambiar el estado de un colaborador',
      })
    }

    const allowed = (toState === STANDBY && canStandby) || (toState === REPORTED && canReport)

    if (!allowed) {
      throw new ForbiddenException({
        code: 'ONLY_STANDBY_OR_REPORT',
        message: 'Desde tu hotel solo puedes mandar a Stand-by o reportar a Rojo',
      })
    }

    if (!user.hotelId || !(await this.repo.isAssignedToHotel(id, user.hotelId))) {
      throw new ForbiddenException({
        code: 'WORKER_NOT_ASSIGNED_TO_YOU',
        message: 'Este colaborador no está asignado a tu hotel',
      })
    }
  }

  private async assertCanSee(id: string, user: AuthenticatedUser): Promise<void> {
    if (await this.permissions.can(user.roleCode, 'recruitment', 'search_candidates')) {
      return
    }

    const seesStaff = await this.permissions.can(user.roleCode, 'staff', 'read_history')

    if (!seesStaff || !user.hotelId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tu rol no puede ver el expediente de un colaborador',
      })
    }

    if (!(await this.repo.isAssignedToHotel(id, user.hotelId))) {
      throw new ForbiddenException({
        code: 'WORKER_NOT_ASSIGNED_TO_YOU',
        message: 'Este colaborador no está asignado a tu hotel',
      })
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

  // Eliminar del Pool (Hugo, 2026-09-15): nunca se borra la fila, `deleted_at`
  // la saca de toda consulta. El controlador libera sus asignaciones ACTIVAS
  // antes de llamar aquí (WorkersController.delete); este guard se queda como
  // red de seguridad, no como el camino esperado.
  async delete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.worker(id)

    if (await this.repo.hasActiveAssignment(id)) {
      throw new ConflictException({
        code: 'WORKER_HAS_ACTIVE_ASSIGNMENT',
        message: 'Tiene una asignación activa: primero hay que terminarla o reasignarla',
      })
    }

    await this.repo.softDelete({ id, userId: user.id, roleCode: user.roleCode })
  }

  async available(id: string, user: AuthenticatedUser): Promise<TransitionOption[]> {
    const current = await this.stateOfWorker(id)
    const steps = await this.repo.allowedFrom(current.stateId)

    return steps
      .filter((s) => s.code !== null && (s.roleCode === null || s.roleCode === user.roleCode))
      .map((s) => ({ toState: s.code as string, requiresReason: s.requiresReason }))
  }

  /**
   * Quién puede mover a un colaborador lo decide la tabla de transiciones. La
   * ruta acepta DOS permisos porque llegan dos roles por caminos distintos:
   * Reclutamiento valida el alta (`recruitment:validate_signup`) y el hotel
   * manda a descansar (`staff:set_standby`) desde Mi Personal.
   *
   * El del hotel viene con alcance: solo sobre quien tiene asignado, y solo a
   * Stand-by. Sin eso, `staff:set_standby` abriría las doce transiciones del
   * semáforo sobre cualquier colaborador.
   */
  async changeState(
    id: string,
    dto: ChangeStateDto,
    user: AuthenticatedUser,
  ): Promise<WorkerEntity> {
    await this.assertCanChangeState(id, dto.toState, user)

    const worker = await this.worker(id)
    const current = await this.stateOfWorker(id)
    const steps = await this.repo.allowedFrom(current.stateId)
    const candidates = steps.filter((s) => s.code === dto.toState)

    if (candidates.length === 0) {
      throw new ConflictException({
        code: 'TRANSITION_NOT_ALLOWED',
        message: `No se puede pasar de ${workerStateLabel(current.code)} a ${workerStateLabel(dto.toState)}`,
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

    // Reglas de Negocio § Validación con expediente incompleto: se puede
    // validar a medias solo a sabiendas, y con eso corren 3 dias para que el
    // colaborador lo complete desde su app (el plazo se calcula al leer, como
    // el del SSN/ITIN).
    const validatesIncomplete = dto.toState === AVAILABLE && !worker.isProfileComplete

    if (validatesIncomplete && !dto.acceptIncompleteProfile) {
      throw new UnprocessableEntityException({
        code: 'PROFILE_INCOMPLETE',
        message: 'El expediente está a medias: no se puede validar al colaborador',
      })
    }

    // Lo que falte de la Fase 1 (posicion, modalidad, ingles, experiencia) lo
    // decide Oranje y el colaborador NO puede llenarlo desde su app: validarlo
    // asi lo dejaria con un plazo que no esta en su mano cumplir.
    if (
      validatesIncomplete &&
      (worker.position === null ||
        worker.hiringModality === null ||
        worker.englishLevel === null ||
        worker.experienceLevel === null)
    ) {
      throw new UnprocessableEntityException({
        code: 'PROFILE_PHASE1_INCOMPLETE',
        message:
          'Posición, modalidad, inglés y experiencia los define Reclutamiento: complétalos antes de validar',
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
      profileDueAt: validatesIncomplete
        ? new Date(Date.now() + PROFILE_GRACE_DAYS * 86_400_000)
        : null,
      userId: user.id,
      roleCode: user.roleCode,
    })

    await this.notifyStateChange(id, worker, current.code, dto.toState, user)

    return this.get(id)
  }

  /**
   * WORKER_STATE_CHANGED es el aviso genérico ("algo cambió, revisa tu
   * estado") y se dispara en TODA transición exitosa. STANDBY_APPLIED,
   * WORKER_REPORTED y WORKER_VALIDATED son avisos ADICIONALES con más detalle
   * para esos tres casos puntuales — el catálogo de notificaciones no los
   * declara excluyentes con el genérico.
   *
   * Best-effort de punta a punta: ningún fallo de aquí (Pub/Sub, o resolver
   * al Manager de Área / Inspector) revierte ni bloquea la transición, que ya
   * quedó escrita.
   */
  private async notifyStateChange(
    id: string,
    worker: WorkerRow,
    fromCode: string,
    toState: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.safeNotify({
      type: 'WORKER_STATE_CHANGED',
      title: 'Cambio de estado',
      body: `Tu estado pasó de ${workerStateLabel(fromCode)} a ${workerStateLabel(toState)}.`,
      entity: { type: 'personal.worker', id },
      actorUserId: user.id,
      audience: [{ kind: 'WORKER', workerId: id }],
    })

    if (toState === AVAILABLE && fromCode === PENDING_VALIDATION) {
      await this.safeNotify({
        type: 'WORKER_VALIDATED',
        title: 'Alta validada',
        body: 'Tu Reclutadora validó tu alta — ya estás disponible.',
        entity: { type: 'personal.worker', id },
        actorUserId: user.id,
        audience: [{ kind: 'WORKER', workerId: id }],
      })
    }

    if (toState === STANDBY) {
      await this.safeNotify({
        type: 'STANDBY_APPLIED',
        title: 'Enviado a descanso',
        body: 'El hotel te envió a descanso.',
        entity: { type: 'personal.worker', id },
        actorUserId: user.id,
        audience: [{ kind: 'WORKER', workerId: id }],
      })

      try {
        const scope = await this.repo.activeAssignmentScope(id)
        const manager = scope
          ? await this.repo.areaManagerOf(scope.hotelId, scope.departmentId)
          : null

        if (manager) {
          await this.safeNotify({
            type: 'STANDBY_APPLIED',
            title: 'Colaborador en descanso',
            body: `${worker.fullName} está en descanso.`,
            entity: { type: 'personal.worker', id },
            actorUserId: user.id,
            audience: [{ kind: 'USER', userId: manager.id }],
          })
        }
      } catch {
        // Mejor esfuerzo: sin asignación resoluble no hay a quién avisar.
      }
    }

    if (toState === REPORTED) {
      try {
        const inspector = await this.repo.inspectorOfZone(worker.zone.id)

        if (inspector) {
          await this.safeNotify({
            type: 'WORKER_REPORTED',
            title: 'Colaborador reportado',
            body: 'El hotel reportó a un colaborador.',
            entity: { type: 'personal.worker', id },
            actorUserId: user.id,
            audience: [{ kind: 'USER', userId: inspector.id }],
          })
        }
      } catch {
        // Mejor esfuerzo.
      }
    }
  }

  private async safeNotify(event: NotificationEvent): Promise<void> {
    try {
      await this.notifications.publish(event)
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte la transición.
    }
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
        message: 'Ese estado no existe en el Semáforo del Colaborador',
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
    profileDueAt: row.profileDueAt?.toISOString() ?? null,
    hasTaxId: row.hasTaxId,
    hasAccount: row.hasAccount,
    email: row.email,
    isBlacklisted: row.isBlacklisted,
    createdAt: new Date(row.createdAt).toISOString(),
  }
}
