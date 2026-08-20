import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

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
  constructor(private readonly repo: ParticipationRepository) {}

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

    return {
      requisitionState: first ? IN_PROGRESS : requisition.stateCode,
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
        message: `El estado ${code} no existe en el Semáforo de Requisición`,
      })
    }

    return state
  }

  private async requisition(
    id: string,
  ): Promise<{ id: string; number: string; stateId: string; stateCode: string }> {
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
