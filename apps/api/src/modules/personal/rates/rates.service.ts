import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'

import type { CloseRateDto, CreateRateDto } from './dto/rate.dto.js'
import { RateRow, RatesRepository } from './rates.repository.js'

export interface RateEntity {
  id: string
  rate: string
  position: { id: string; code: string; name: string } | null
  validFrom: string
  validTo: string | null
  isActive: boolean
  reason: string | null
  authorizedBy: { id: string; fullName: string }
  createdAt: string
}

@Injectable()
export class RatesService {
  constructor(private readonly repo: RatesRepository) {}

  async list(workerId: string): Promise<RateEntity[]> {
    await this.worker(workerId)

    return (await this.repo.listAll(workerId)).map(toEntity)
  }

  async create(workerId: string, dto: CreateRateDto, user: AuthenticatedUser): Promise<RateEntity> {
    await this.worker(workerId)

    const positionId = dto.catalogPositionId ?? null

    if (positionId && !(await this.repo.positionExists(positionId))) {
      throw new NotFoundException({
        code: 'POSITION_NOT_FOUND',
        message: 'La posición no existe',
      })
    }

    const active = await this.repo.activeFor(workerId, positionId)

    if (active && dto.validFrom <= active.validFrom) {
      throw new UnprocessableEntityException({
        code: 'RATE_OVERLAPS',
        message: `El rate vigente empieza el ${active.validFrom
          .toISOString()
          .slice(0, 10)}: el nuevo tiene que arrancar después`,
      })
    }

    const id = await this.repo.create({
      workerId,
      rate: dto.rate,
      catalogPositionId: positionId,
      validFrom: dto.validFrom,
      reason: dto.reason ?? null,
      userId: user.id,
      roleCode: user.roleCode,
      closes: active?.id ?? null,
    })

    return this.get(workerId, id)
  }

  async close(
    workerId: string,
    id: string,
    dto: CloseRateDto,
    user: AuthenticatedUser,
  ): Promise<RateEntity> {
    await this.worker(workerId)

    const row = await this.rate(workerId, id)

    if (row.validTo !== null) {
      throw new ConflictException({
        code: 'RATE_ALREADY_CLOSED',
        message: 'Ese rate ya está cerrado',
      })
    }

    if (dto.validTo <= row.validFrom) {
      throw new UnprocessableEntityException({
        code: 'VALIDITY_BACKWARDS',
        message: 'El cierre no puede ser anterior al inicio',
      })
    }

    await this.repo.close({
      id,
      workerId,
      validTo: dto.validTo,
      userId: user.id,
      roleCode: user.roleCode,
    })

    return this.get(workerId, id)
  }

  async get(workerId: string, id: string): Promise<RateEntity> {
    return toEntity(await this.rate(workerId, id))
  }

  private async rate(workerId: string, id: string): Promise<RateRow> {
    const row = await this.repo.byId(workerId, id)

    if (!row) {
      throw new NotFoundException({
        code: 'RATE_NOT_FOUND',
        message: 'El rate no existe para este colaborador',
      })
    }

    return row
  }

  private async worker(id: string): Promise<{ id: string; fullName: string }> {
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

function toEntity(row: RateRow): RateEntity {
  return {
    id: row.id,
    rate: row.rate,
    position: row.position,
    validFrom: new Date(row.validFrom).toISOString().slice(0, 10),
    validTo: row.validTo ? new Date(row.validTo).toISOString().slice(0, 10) : null,
    isActive: row.validTo === null,
    reason: row.reason,
    authorizedBy: row.authorizedBy,
    createdAt: new Date(row.createdAt).toISOString(),
  }
}
