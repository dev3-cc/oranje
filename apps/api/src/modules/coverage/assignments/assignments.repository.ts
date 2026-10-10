import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export const COVERAGE_LIGHT = 'POSITION_COVERAGE'
export const REQUISITION_LIGHT = 'REQUISITION'

export interface AssignmentRow {
  id: string
  type: string
  status: string
  createdAt: Date
  slot: { id: string; ordinal: number; positionId: string }
  worker: { id: string; fullName: string }
}

const SELECT = {
  id: true,
  type: true,
  status: true,
  createdAt: true,
  slot: { select: { id: true, ordinal: true, positionId: true } },
  worker: { select: { id: true, fullName: true } },
} as const

@Injectable()
export class AssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async position(id: string): Promise<{
    id: string
    requisitionId: string
    quantity: number
    deletedAt: Date | null
    coverageStateId: string
    requisitionState: string
    requisitionStateId: string
    requisitionCreatedBy: string | null
    requisitionAreaManagerUserId: string | null
  } | null> {
    const row = await this.prisma.position.findUnique({
      where: { id },
      select: {
        id: true,
        requisitionId: true,
        quantity: true,
        deletedAt: true,
        coverageStateId: true,
        requisition: {
          select: {
            statusLightStateId: true,
            statusState: { select: { code: true } },
            createdBy: true,
            areaManagerUserId: true,
          },
        },
      },
    })

    return row
      ? {
          id: row.id,
          requisitionId: row.requisitionId,
          quantity: row.quantity,
          deletedAt: row.deletedAt,
          coverageStateId: row.coverageStateId,
          requisitionState: row.requisition.statusState.code,
          requisitionStateId: row.requisition.statusLightStateId,
          requisitionCreatedBy: row.requisition.createdBy,
          requisitionAreaManagerUserId: row.requisition.areaManagerUserId,
        }
      : null
  }

  async freeSlot(positionId: string): Promise<{ id: string; ordinal: number } | null> {
    return this.prisma.slot.findFirst({
      where: { positionId, status: 'free' },
      orderBy: { ordinal: 'asc' },
      select: { id: true, ordinal: true },
    })
  }

  /** El lugar N de una posición, para validar el que eligieron. */
  async slotAt(
    positionId: string,
    ordinal: number,
  ): Promise<{ id: string; ordinal: number; status: string } | null> {
    return this.prisma.slot.findFirst({
      where: { positionId, ordinal },
      select: { id: true, ordinal: true, status: true },
    })
  }

  /**
   * Cierra SOLO la asignación, sin tocar el slot ni la cobertura.
   *
   * Para las vencidas de una requisición que ya cerró: la persona tiene que
   * quedar libre —su plazo terminó— pero la requisición es historia y no se
   * reabre, así que su cobertura y sus slots se quedan como quedaron.
   */
  async closeAssignmentOnly(params: {
    assignmentId: string
    reason: string
    userId: string
    roleCode: string
    /** La persona vuelve a su estado igual: la requisición es lo que no se toca. */
    workerState?: { workerId: string; fromStateId: string; toStateId: string } | null
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: params.assignmentId },
        data: { status: 'CLOSED', closedReason: params.reason, updatedAt: new Date() },
      })

      if (params.workerState) {
        await tx.worker.update({
          where: { id: params.workerState.workerId },
          data: { statusLightStateId: params.workerState.toStateId, updatedAt: new Date() },
        })
        await tx.workerStateHistory.create({
          data: {
            id: uuidv7(),
            workerId: params.workerState.workerId,
            fromStateId: params.workerState.fromStateId,
            toStateId: params.workerState.toStateId,
            statusLightCode: 'WORKER',
            userId: params.userId,
          },
        })
      }
      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment',
          entityId: params.assignmentId,
          eventType: 'ASSIGNMENT_CLOSED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { reason: params.reason, requisitionClosed: true },
        },
      })
    })
  }

  /** En qué estado del semáforo está hoy el colaborador. */
  async workerState(workerId: string): Promise<{ stateId: string; code: string } | null> {
    const row = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { statusLightStateId: true, statusState: { select: { code: true } } },
    })
    return row ? { stateId: row.statusLightStateId, code: row.statusState.code } : null
  }

  /**
   * De qué estado venía antes de entrar a Café.
   *
   * La transición `BROWN -> (estado previo)` está sembrada con destino nulo a
   * propósito: el vault dice que al vencer vuelve a `Amarillo` si sigue en
   * descanso y a `Verde fuerte` si ya no. Quién fue ese «antes» lo dice la
   * historia, no una regla.
   */
  async stateBeforeBrown(workerId: string, brownStateId: string): Promise<{ id: string } | null> {
    const row = await this.prisma.workerStateHistory.findFirst({
      where: { workerId, toStateId: brownStateId },
      orderBy: { occurredAt: 'desc' },
      select: { fromStateId: true },
    })
    /* `fromStateId` es nulable: el primer renglón de la historia nace sin
       origen. Si no hay de dónde volver, quien llame decide. */
    return row?.fromStateId ? { id: row.fromStateId } : null
  }

  /** La cuenta con la que firma el sistema; la siembra el seed. */
  async systemActor(email: string): Promise<{ id: string; roleCode: string } | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: { select: { code: true } } },
    })
    return row ? { id: row.id, roleCode: row.role.code } : null
  }

  /**
   * Las temporales que ya cumplieron sus días y siguen ACTIVE.
   *
   * `upper(validity)` es exclusivo —`daterange` lo normaliza a `[inicio, fin)`—
   * así que `<= current_date` significa «su último día ya pasó», no «termina
   * hoy»: una asignación que corre hasta hoy todavía cuenta.
   */
  async expiredActive(limit: number, workerId?: string): Promise<Array<{ id: string }>> {
    return this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT a.id::text
        FROM coverage.assignment a
       WHERE a.status = 'ACTIVE'
         AND upper(a.validity) IS NOT NULL
         AND upper(a.validity) <= current_date
         AND (${workerId ?? null}::uuid IS NULL OR a.worker_id = ${workerId ?? null}::uuid)
       ORDER BY upper(a.validity)
       LIMIT ${limit}`
  }

  async worker(
    id: string,
  ): Promise<{ id: string; fullName: string; deletedAt: Date | null } | null> {
    return this.prisma.worker.findUnique({
      where: { id },
      select: { id: true, fullName: true, deletedAt: true },
    })
  }

  async activeAssignmentOf(workerId: string): Promise<{ id: string } | null> {
    return this.prisma.assignment.findFirst({
      where: { workerId, status: 'ACTIVE' },
      select: { id: true },
    })
  }

  // Un colaborador puede tener más de una ACTIVA a la vez (RR-05 solo prohíbe
  // horas que chocan, no dos hoteles): eliminarlo del Pool libera TODAS.
  async activeAssignmentIdsOf(workerId: string): Promise<string[]> {
    const rows = await this.prisma.assignment.findMany({
      where: { workerId, status: 'ACTIVE' },
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }

  async byId(id: string): Promise<AssignmentRow | null> {
    return this.prisma.assignment.findUnique({ where: { id }, select: SELECT })
  }

  async listByRequisition(requisitionId: string): Promise<AssignmentRow[]> {
    return this.prisma.assignment.findMany({
      where: { slot: { position: { requisitionId } }, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: SELECT,
    })
  }

  /** `null` si la requisición no existe. Sirve para acotar por hotel antes de listar. */
  async requisitionHotelId(requisitionId: string): Promise<string | null> {
    const row = await this.prisma.requisition.findUnique({
      where: { id: requisitionId },
      select: { hotelId: true },
    })

    return row?.hotelId ?? null
  }

  async coverageOf(
    requisitionId: string,
  ): Promise<
    Array<{ positionId: string; quantity: number; taken: number; coverageStateId: string }>
  > {
    const rows = await this.prisma.position.findMany({
      where: { requisitionId, deletedAt: null },
      select: {
        id: true,
        quantity: true,
        coverageStateId: true,
        slots: { select: { status: true } },
      },
    })

    return rows.map((p) => ({
      positionId: p.id,
      quantity: p.quantity,
      taken: p.slots.filter((s) => s.status === 'taken').length,
      coverageStateId: p.coverageStateId,
    }))
  }

  async stateByCode(light: string, code: string): Promise<{ id: string } | null> {
    return this.prisma.statusLightState.findFirst({
      where: { code, statusLightCode: light },
      select: { id: true },
    })
  }

  async assign(params: {
    slotId: string
    workerId: string
    type: string
    startDate: Date
    endDate: Date | null
    requisitionId: string
    positionId: string
    coverageStateId: string
    requisitionStateId: string | null
    fromRequisitionStateId: string
    userId: string
    roleCode: string
    /**
     * A qué estado pasa el colaborador y desde cuál. `null` = no se toca.
     * Solo la temporal mueve el semáforo al asignar: la fija espera al día 1
     * (Semáforo del Colaborador).
     */
    workerState: { fromStateId: string; toStateId: string } | null
  }): Promise<AssignmentRow> {
    const id = uuidv7()
    const upper = params.endDate ? params.endDate.toISOString().slice(0, 10) : null
    const lower = params.startDate.toISOString().slice(0, 10)

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO coverage.assignment (id, slot_id, worker_id, type, validity, status, assigned_by)
        VALUES (
          ${id}::uuid,
          ${params.slotId}::uuid,
          ${params.workerId}::uuid,
          ${params.type},
          daterange(${lower}::date, ${upper}::date, '[)'),
          'ACTIVE',
          ${params.userId}::uuid
        )`

      await tx.slot.update({
        where: { id: params.slotId },
        data: { status: 'taken', updatedAt: new Date() },
      })

      /* El semáforo del colaborador va en la MISMA transacción que la
         asignación: son el mismo hecho, y que uno pueda quedar sin el otro
         deja a alguien en Café sin asignación o al revés. */
      if (params.workerState) {
        await tx.worker.update({
          where: { id: params.workerId },
          data: { statusLightStateId: params.workerState.toStateId, updatedAt: new Date() },
        })
        await tx.workerStateHistory.create({
          data: {
            id: uuidv7(),
            workerId: params.workerId,
            fromStateId: params.workerState.fromStateId,
            toStateId: params.workerState.toStateId,
            statusLightCode: 'WORKER',
            userId: params.userId,
          },
        })
      }

      await tx.position.update({
        where: { id: params.positionId },
        data: {
          coverageStateId: params.coverageStateId,
          coverageLightCode: COVERAGE_LIGHT,
          updatedAt: new Date(),
        },
      })

      if (params.requisitionStateId) {
        await tx.requisition.update({
          where: { id: params.requisitionId },
          data: {
            statusLightStateId: params.requisitionStateId,
            updatedAt: new Date(),
            updatedBy: params.userId,
          },
        })

        await tx.requisitionStateHistory.create({
          data: {
            id: uuidv7(),
            requisitionId: params.requisitionId,
            fromStateId: params.fromRequisitionStateId,
            toStateId: params.requisitionStateId,
            statusLightCode: REQUISITION_LIGHT,
            userId: params.userId,
          },
        })
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment',
          entityId: id,
          eventType: 'WORKER_ASSIGNED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: {
            requisitionId: params.requisitionId,
            positionId: params.positionId,
            workerId: params.workerId,
            type: params.type,
          },
        },
      })
    })

    return this.prisma.assignment.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async release(params: {
    assignmentId: string
    slotId: string
    positionId: string
    coverageStateId: string
    reason: string
    userId: string
    roleCode: string
    /**
     * `CANCELLED` la soltó una persona antes de tiempo; `CLOSED` se le acabaron
     * los días. El `CHECK` distingue los dos desde la primera migración y hasta
     * hoy nadie escribía `CLOSED`, porque nada cerraba solo.
     */
    status?: 'CANCELLED' | 'CLOSED'
    eventType?: 'ASSIGNMENT_RELEASED' | 'ASSIGNMENT_CLOSED'
    /** A dónde vuelve el colaborador; `null` = su semáforo no se toca. */
    workerState?: { workerId: string; fromStateId: string; toStateId: string } | null
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: params.assignmentId },
        data: {
          status: params.status ?? 'CANCELLED',
          closedReason: params.reason,
          updatedAt: new Date(),
        },
      })

      await tx.slot.update({
        where: { id: params.slotId },
        data: { status: 'free', updatedAt: new Date() },
      })

      await tx.position.update({
        where: { id: params.positionId },
        data: {
          coverageStateId: params.coverageStateId,
          coverageLightCode: COVERAGE_LIGHT,
          updatedAt: new Date(),
        },
      })

      if (params.workerState) {
        await tx.worker.update({
          where: { id: params.workerState.workerId },
          data: { statusLightStateId: params.workerState.toStateId, updatedAt: new Date() },
        })
        await tx.workerStateHistory.create({
          data: {
            id: uuidv7(),
            workerId: params.workerState.workerId,
            fromStateId: params.workerState.fromStateId,
            toStateId: params.workerState.toStateId,
            statusLightCode: 'WORKER',
            userId: params.userId,
          },
        })
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'coverage.assignment',
          entityId: params.assignmentId,
          eventType: params.eventType ?? 'ASSIGNMENT_RELEASED',
          actorUserId: params.userId,
          actorRole: params.roleCode,
          payload: { reason: params.reason },
        },
      })
    })
  }
}
