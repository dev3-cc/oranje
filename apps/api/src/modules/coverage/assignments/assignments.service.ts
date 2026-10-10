import {
  Logger,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import { SYSTEM_USER_EMAIL } from '../../../common/constants/system-actor.js'
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

const WORKER_LIGHT = 'WORKER'
const BROWN = 'BROWN'
const ORANGE = 'ORANGE'
const STRONG_GREEN = 'STRONG_GREEN'
/** Los dos orígenes que el vault admite hacia Café. */
const PUEDEN_IR_A_CAFE = ['STRONG_GREEN', 'YELLOW']

export interface AssignmentEntity {
  id: string
  type: string
  status: string
  worker: { id: string; fullName: string }
  /**
   * `positionId` viaja a propósito: `GET /requisitions/:id/assignments` las
   * devuelve de TODA la requisición, y sin él quien las consume no puede saber
   * de qué renglón es cada una. El tablero de slots lo adivinaba y mezclaba
   * renglones (Hugo, 2026-10-09).
   */
  slot: { id: string; ordinal: number; positionId: string }
  createdAt: string
}

export interface AssignmentResult {
  assignment: AssignmentEntity
  positionCoverage: string
  requisitionState: string
}

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name)

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

    /* Lo que ya terminó no la ocupa. Se cierra aquí y no solo en el barrido
       para que el rechazo y la lista de asignables digan lo mismo: la lista
       descarta las vencidas, y sin esto el servidor rechazaría a alguien que
       la pantalla acaba de ofrecer (Hugo, 2026-10-09). */
    await this.closeExpired(10, dto.workerId)

    if (await this.repo.activeAssignmentOf(dto.workerId)) {
      throw new ConflictException({
        code: 'WORKER_ALREADY_ASSIGNED',
        message: `${worker.fullName} ya tiene una asignación activa`,
      })
    }

    const slot = await this.resolveSlot(dto.positionId, dto.slotOrdinal)

    const coverage = await this.coverageAfter(position.requisitionId, dto.positionId, 1)
    const coverageState = await this.stateOf(COVERAGE_LIGHT, coverage.positionCode)

    const closes = coverage.allCovered && position.requisitionState === IN_PROGRESS
    const requisitionState = closes ? await this.stateOf(REQUISITION_LIGHT, FULLY_COVERED) : null
    const startDate = dto.startDate ?? new Date()

    /*
     * El semáforo del colaborador: la temporal lo pasa a Café al asignar
     * (Semáforo del Colaborador: `Verde fuerte / Amarillo -> Café`). La fija
     * NO se mueve aquí — el vault la mueve a Verde manzana cuando la persona
     * ASISTE el día 1, que es otro hecho.
     *
     * Solo desde Verde fuerte o Amarillo: si está en otro estado, alguien lo
     * puso ahí por una razón y la asignación no lo pisa (mismo criterio que el
     * cierre del accidente).
     */
    const workerState = await this.brownTransition(dto.workerId, dto.type)

    const row = await this.repo.assign({
      workerState,
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

  /**
   * De Café al estado del que vino, al terminar la asignación.
   *
   * Solo si HOY está en Café: si alguien ya lo movió —a Rojo, a Gris, a la
   * Blacklist— el cierre de la asignación no le pisa su estado.
   */
  private async returnFromBrown(
    workerId: string,
  ): Promise<{ workerId: string; fromStateId: string; toStateId: string } | null> {
    const actual = await this.repo.workerState(workerId)
    if (!actual) return null

    /*
     * Naranja → Verde fuerte, «queda libre»: el final de una asignación FIJA.
     * Está sembrada a nombre del Sistema y tampoco la disparaba nadie, así que
     * quien terminaba un fijo se quedaba en Naranja para siempre (Hugo,
     * 2026-10-09).
     */
    if (actual.code === ORANGE) {
      const disponible = await this.repo.stateByCode(WORKER_LIGHT, STRONG_GREEN)
      return disponible ? { workerId, fromStateId: actual.stateId, toStateId: disponible.id } : null
    }

    if (actual.code !== BROWN) return null

    const previo = await this.repo.stateBeforeBrown(workerId, actual.stateId)
    /* Sin historia de dónde venía, vuelve a Disponible: es el estado neutro de
       quien no tiene asignación, y dejarlo en Café sería peor. */
    const destino = previo ?? (await this.repo.stateByCode(WORKER_LIGHT, STRONG_GREEN))
    if (!destino) return null

    return { workerId, fromStateId: actual.stateId, toStateId: destino.id }
  }

  /** De Verde fuerte o Amarillo a Café, solo para la temporal. */
  private async brownTransition(
    workerId: string,
    type: string,
  ): Promise<{ fromStateId: string; toStateId: string } | null> {
    if (type !== 'TEMPORARY') return null

    const actual = await this.repo.workerState(workerId)
    if (!actual || !PUEDEN_IR_A_CAFE.includes(actual.code)) return null

    const café = await this.repo.stateByCode(WORKER_LIGHT, BROWN)
    if (!café) return null

    return { fromStateId: actual.stateId, toStateId: café.id }
  }

  /**
   * Cierra las asignaciones temporales a las que se les acabaron los días.
   *
   * El vault dice que la temporal «se cierra automáticamente al vencer esos
   * días», y hasta hoy no lo hacía nadie: quedaban ACTIVE para siempre, su
   * slot seguía ocupado y la persona no volvía a aparecer como asignable
   * (Hugo, 2026-10-09; en la base de dev había tres de junio y septiembre).
   *
   * Va una por una con el mismo `release()` de siempre —libera el slot,
   * recalcula la cobertura, deja rastro y avisa— y no en un solo UPDATE: así
   * no hay dos caminos que puedan separarse. Si una falla, las demás siguen:
   * una requisición ya cerrada no debe impedir que se limpien las otras.
   *
   * `tope` existe para que una base con años de rezago no intente cerrarlas
   * todas en una llamada; la siguiente corrida toma las que queden.
   */
  async closeExpired(
    tope = 200,
    /** Solo las de esta persona; sin él, todas las de la base. */
    workerId?: string,
  ): Promise<{ cerradas: number; fallidas: number }> {
    const actor = await this.repo.systemActor(SYSTEM_USER_EMAIL)

    if (!actor) {
      throw new NotFoundException({
        code: 'SYSTEM_ACTOR_MISSING',
        message: `Falta la cuenta del sistema (${SYSTEM_USER_EMAIL}): córrele el seed`,
      })
    }

    const user: AuthenticatedUser = {
      id: actor.id,
      roleCode: actor.roleCode,
      hotelId: null,
      departmentId: null,
    }
    const vencidas = await this.repo.expiredActive(tope, workerId)
    let cerradas = 0
    const fallidas: string[] = []

    const RAZÓN = 'Terminó el plazo de la asignación temporal'

    for (const { id } of vencidas) {
      try {
        await this.release(id, RAZÓN, user, 'CLOSED')
        cerradas += 1
      } catch (error) {
        /*
         * Una requisición ya cerrada no se reabre, y `release` lo impide bien
         * —recalcula la cobertura—. Pero la persona SÍ tiene que quedar libre:
         * su plazo terminó. Se cierra solo la asignación y la requisición se
         * queda como está (Hugo, 2026-10-09; en dev había dos así, de junio,
         * que de otro modo quedaban ocupadas para siempre).
         */
        if (esRequisiciónCerrada(error)) {
          const fila = await this.repo.byId(id)
          await this.repo.closeAssignmentOnly({
            assignmentId: id,
            reason: RAZÓN,
            userId: user.id,
            roleCode: user.roleCode,
            workerState: fila ? await this.returnFromBrown(fila.worker.id) : null,
          })
          cerradas += 1
          continue
        }
        fallidas.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (fallidas.length > 0) {
      this.logger.warn(`Asignaciones vencidas que no se pudieron cerrar: ${fallidas.join(' · ')}`)
    }

    return { cerradas, fallidas: fallidas.length }
  }

  async release(
    id: string,
    reason: string,
    user: AuthenticatedUser,
    /** `CLOSED` solo lo usa el cierre automático: se acabaron los días. */
    status: 'CANCELLED' | 'CLOSED' = 'CANCELLED',
  ): Promise<AssignmentEntity> {
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

    /* De Café de vuelta a donde estaba. La transición sembrada tiene destino
       NULO a propósito —«vuelve al estado previo»—, así que el destino lo dice
       la historia: Amarillo si venía de descanso, Verde fuerte si no. */
    const workerState = await this.returnFromBrown(row.worker.id)

    await this.repo.release({
      workerState,
      assignmentId: id,
      slotId: row.slot.id,
      positionId: row.slot.positionId,
      coverageStateId: coverageState.id,
      reason,
      userId: user.id,
      roleCode: user.roleCode,
      status,
      eventType: status === 'CLOSED' ? 'ASSIGNMENT_CLOSED' : 'ASSIGNMENT_RELEASED',
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

  /**
   * El lugar que se va a ocupar: el que eligieron, o el primero libre.
   *
   * Que siga libre lo sostiene la base (`ux_slot_active_assignment`); mirarlo
   * aquí solo sirve para dar un mensaje que se entienda en vez del error del
   * motor, y no sustituye a la restricción: entre este SELECT y el INSERT cabe
   * otra Reclutadora (RR-15).
   */
  private async resolveSlot(
    positionId: string,
    ordinal: number | undefined,
  ): Promise<{ id: string; ordinal: number }> {
    if (ordinal === undefined) {
      const libre = await this.repo.freeSlot(positionId)
      if (!libre) {
        throw new UnprocessableEntityException({
          code: 'POSITION_FULL',
          message: 'Esta posición ya no tiene lugares libres',
        })
      }
      return libre
    }

    const slot = await this.repo.slotAt(positionId, ordinal)
    if (!slot) {
      throw new UnprocessableEntityException({
        code: 'SLOT_NOT_IN_POSITION',
        message: `Esta posición no tiene un lugar ${String(ordinal)}`,
      })
    }
    if (slot.status !== 'free') {
      throw new ConflictException({
        code: 'SLOT_TAKEN',
        message: `El lugar ${String(ordinal)} ya está ocupado`,
      })
    }
    return { id: slot.id, ordinal: slot.ordinal }
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

/** El rechazo de `release` cuando la requisición ya cerró, por su código. */
function esRequisiciónCerrada(error: unknown): boolean {
  const response = (error as { response?: { code?: string } } | undefined)?.response
  return response?.code === 'REQUISITION_CLOSED'
}

function toEntity(row: AssignmentRow): AssignmentEntity {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    worker: row.worker,
    slot: { id: row.slot.id, ordinal: row.slot.ordinal, positionId: row.slot.positionId },
    createdAt: row.createdAt.toISOString(),
  }
}
