import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import { BlacklistRepository, EntryRow } from './blacklist.repository.js'
import type { CreateEntryDto, LiftDto } from './dto/blacklist.dto.js'

const BLACKLISTED = 'BLACK'
const REENTRY = 'WHITE'
const PROTECTED = 'GRAY'

export interface EntryEntity {
  id: string
  worker: { id: string; fullName: string }
  source: string
  reason: string
  evidencePath: string | null
  occurredAt: string
  isActive: boolean
  enteredBy: { id: string; fullName: string }
  liftedAt: string | null
  liftedBy: { id: string; fullName: string } | null
  liftReason: string | null
}

@Injectable()
export class BlacklistService {
  constructor(private readonly repo: BlacklistRepository) {}

  async list(workerId?: string, onlyActive = false): Promise<EntryEntity[]> {
    return (await this.repo.listAll({ workerId, onlyActive })).map(toEntity)
  }

  async create(
    workerId: string,
    dto: CreateEntryDto,
    user: AuthenticatedUser,
  ): Promise<EntryEntity> {
    const worker = await this.worker(workerId)

    if (worker.stateCode === PROTECTED) {
      throw new ConflictException({
        code: 'WORKER_PROTECTED',
        message: `${worker.fullName} está accidentado: el estado Gris protege de la Blacklist`,
      })
    }

    const active = await this.repo.activeOf(workerId)

    if (active) {
      throw new ConflictException({
        code: 'ALREADY_BLACKLISTED',
        message: `${worker.fullName} ya tiene un veto vigente desde el ${active.occurredAt
          .toISOString()
          .slice(0, 10)}`,
        details: [{ field: 'blacklistEntryId', value: active.id }],
      })
    }

    const black = await this.stateOf(BLACKLISTED)

    const id = await this.repo.create({
      workerId,
      source: dto.source,
      reason: dto.reason,
      evidencePath: dto.evidencePath ?? null,
      fromStateId: worker.stateId,
      toStateId: black.id,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(id)
  }

  async lift(workerId: string, dto: LiftDto, user: AuthenticatedUser): Promise<EntryEntity> {
    const worker = await this.worker(workerId)
    const active = await this.repo.activeOf(workerId)

    if (!active) {
      throw new ConflictException({
        code: 'NOT_BLACKLISTED',
        message: `${worker.fullName} no tiene un veto vigente`,
      })
    }

    const white = await this.stateOf(REENTRY)

    await this.repo.lift({
      entryId: active.id,
      workerId,
      liftReason: dto.liftReason,
      fromStateId: worker.stateId,
      toStateId: white.id,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(active.id)
  }

  async get(id: string): Promise<EntryEntity> {
    const row = await this.repo.byId(id)

    if (!row) {
      throw new NotFoundException({
        code: 'BLACKLIST_ENTRY_NOT_FOUND',
        message: 'El registro no existe',
      })
    }

    return toEntity(row)
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

  private async worker(
    id: string,
  ): Promise<{ id: string; fullName: string; stateId: string; stateCode: string }> {
    const row = await this.repo.worker(id)

    if (!row) {
      throw new NotFoundException({
        code: 'WORKER_NOT_FOUND',
        message: 'El colaborador no existe',
      })
    }

    return row
  }
}

function toEntity(row: EntryRow): EntryEntity {
  return {
    id: row.id,
    worker: row.worker,
    source: row.source,
    reason: row.reason,
    evidencePath: row.evidencePath,
    occurredAt: row.occurredAt.toISOString(),
    isActive: row.liftedAt === null,
    enteredBy: row.enteredBy,
    liftedAt: row.liftedAt?.toISOString() ?? null,
    liftedBy: row.liftedBy,
    liftReason: row.liftReason,
  }
}
