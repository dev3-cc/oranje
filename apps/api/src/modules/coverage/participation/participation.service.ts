import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { NotificationPublisherService } from '../../notifications/index.js'

import { ParticipantRow, ParticipationRepository } from './participation.repository.js'

const AUTHORIZED = 'GREEN'
const IN_PROGRESS = 'YELLOW'
const OPEN_STATES = [AUTHORIZED, IN_PROGRESS]

export interface ParticipantEntity {
  id: string
  user: { id: string; fullName: string; role: { code: string; name: string } }
  joinedAt: string
}

export interface ParticipationResult {
  requisitionState: string
  participants: ParticipantEntity[]
}

@Injectable()
export class ParticipationService {
  constructor(
    private readonly repo: ParticipationRepository,
    private readonly notifications: NotificationPublisherService,
  ) {}

  async list(requisitionId: string): Promise<ParticipantEntity[]> {
    await this.requisition(requisitionId)

    return (await this.repo.active(requisitionId)).map(toEntity)
  }

  async join(requisitionId: string, user: AuthenticatedUser): Promise<ParticipationResult> {
    const requisition = await this.requisition(requisitionId)

    if (!OPEN_STATES.includes(requisition.stateCode)) {
      throw new ConflictException({
        code: 'REQUISITION_NOT_OPEN',
        message: `Solo se toma una requisición autorizada o en proceso, y esta está en ${requisition.stateCode}`,
      })
    }

    if (await this.repo.mine(requisitionId, user.id)) {
      throw new ConflictException({
        code: 'ALREADY_PARTICIPATING',
        message: 'Ya estás trabajando esta requisición',
      })
    }

    const first = requisition.stateCode === AUTHORIZED
    const target = first ? await this.stateOf(IN_PROGRESS) : null

    await this.repo.join({
      requisitionId,
      userId: user.id,
      roleCode: user.roleCode,
      fromStateId: requisition.stateId,
      toStateId: target?.id ?? null,
    })

    const participants = (await this.repo.active(requisitionId)).map(toEntity)

    if (first) {
      // REQ_TAKEN: avisa al Supervisor y al Manager de Área de que su
      // requisición ya tiene quien la cubra.
      const audience = [requisition.createdBy, requisition.areaManagerUserId]
        .filter((id): id is string => Boolean(id))
        .map((userId) => ({ kind: 'USER' as const, userId }))

      if (audience.length > 0) {
        try {
          await this.notifications.publish({
            type: 'REQ_TAKEN',
            title: 'Requisición tomada',
            body: 'Tu requisición ya tiene quien la cubra.',
            entity: { type: 'demand.requisition', id: requisitionId },
            actorUserId: user.id,
            audience,
          })
        } catch {
          // Mejor esfuerzo: que Pub/Sub no responda no revierte la toma.
        }
      }
    } else {
      // REQ_PARTICIPANT_JOINED: avisa a las OTRAS Reclutadoras que ya están
      // trabajando esta requisición, nunca a quien se acaba de unir.
      const others = participants
        .filter((p) => p.user.id !== user.id)
        .map((p) => ({ kind: 'USER' as const, userId: p.user.id }))

      if (others.length > 0) {
        try {
          await this.notifications.publish({
            type: 'REQ_PARTICIPANT_JOINED',
            title: 'Otra Reclutadora se unió',
            body: 'Otra Reclutadora se unió a la requisición que estás cubriendo.',
            entity: { type: 'demand.requisition', id: requisitionId },
            actorUserId: user.id,
            audience: others,
          })
        } catch {
          // Mejor esfuerzo: que Pub/Sub no responda no revierte la unión.
        }
      }
    }

    return {
      requisitionState: first ? IN_PROGRESS : requisition.stateCode,
      participants,
    }
  }

  /**
   * REQ_REASSIGNED: el Líder mueve una requisición de una Reclutadora a
   * otra, sin tocar el semáforo — sigue IN_PROGRESS, solo cambia quién la
   * trabaja. Avisa a las dos y a sus dos Líderes (RF-37).
   */
  async reassign(
    requisitionId: string,
    fromUserId: string,
    toUserId: string,
    user: AuthenticatedUser,
  ): Promise<ParticipationResult> {
    if (fromUserId === toUserId) {
      throw new ConflictException({
        code: 'SAME_RECRUITER',
        message: 'Ya está trabajando esta requisición',
      })
    }

    await this.requisition(requisitionId)

    const from = await this.repo.mine(requisitionId, fromUserId)

    if (!from) {
      throw new NotFoundException({
        code: 'PARTICIPATION_NOT_FOUND',
        message: 'Esa Reclutadora no está trabajando esta requisición',
      })
    }

    if (await this.repo.mine(requisitionId, toUserId)) {
      throw new ConflictException({
        code: 'ALREADY_PARTICIPATING',
        message: 'Ya está trabajando esta requisición',
      })
    }

    await this.repo.reassign({
      requisitionId,
      fromParticipationId: from.id,
      toUserId,
      userId: user.id,
      roleCode: user.roleCode,
    })

    const [fromBoss, toBoss] = await Promise.all([
      this.repo.bossOf(fromUserId),
      this.repo.bossOf(toUserId),
    ])

    const audience = [...new Set([fromUserId, toUserId, fromBoss, toBoss])]
      .filter((id): id is string => Boolean(id))
      .map((userId) => ({ kind: 'USER' as const, userId }))

    try {
      await this.notifications.publish({
        type: 'REQ_REASSIGNED',
        title: 'Requisición reasignada',
        body: 'Se reasignó una requisición a otra Reclutadora.',
        entity: { type: 'demand.requisition', id: requisitionId },
        actorUserId: user.id,
        audience,
      })
    } catch {
      // Mejor esfuerzo: que Pub/Sub no responda no revierte la reasignación.
    }

    return {
      requisitionState: (await this.requisition(requisitionId)).stateCode,
      participants: (await this.repo.active(requisitionId)).map(toEntity),
    }
  }

  async leave(requisitionId: string, user: AuthenticatedUser): Promise<ParticipationResult> {
    const requisition = await this.requisition(requisitionId)
    const mine = await this.repo.mine(requisitionId, user.id)

    if (!mine) {
      throw new ConflictException({
        code: 'NOT_PARTICIPATING',
        message: 'No estás trabajando esta requisición',
      })
    }

    const active = await this.repo.active(requisitionId)
    const last = active.length === 1 && requisition.stateCode === IN_PROGRESS
    const target = last ? await this.stateOf(AUTHORIZED) : null

    await this.repo.leave({
      participationId: mine.id,
      requisitionId,
      userId: user.id,
      roleCode: user.roleCode,
      fromStateId: requisition.stateId,
      toStateId: target?.id ?? null,
    })

    return {
      requisitionState: last ? AUTHORIZED : requisition.stateCode,
      participants: (await this.repo.active(requisitionId)).map(toEntity),
    }
  }

  private async stateOf(code: string): Promise<{ id: string }> {
    const state = await this.repo.stateByCode(code)

    if (!state) {
      throw new ConflictException({
        code: 'STATE_NOT_FOUND',
        message: 'Ese estado no existe en el Semáforo de Requisición',
      })
    }

    return state
  }

  private async requisition(id: string): Promise<{
    id: string
    number: string
    stateId: string
    stateCode: string
    createdBy: string | null
    areaManagerUserId: string | null
  }> {
    const row = await this.repo.requisition(id)

    if (!row || row.deletedAt !== null) {
      throw new NotFoundException({
        code: 'REQUISITION_NOT_FOUND',
        message: 'La requisición no existe',
      })
    }

    return row
  }
}

function toEntity(row: ParticipantRow): ParticipantEntity {
  return { id: row.id, user: row.user, joinedAt: row.joinedAt.toISOString() }
}
