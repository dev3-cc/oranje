import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PermissionsService } from '../../identity/index.js'

import type { CreateProspectDto } from './dto/create-prospect.dto.js'
import type { QueryProspectsDto } from './dto/query-prospects.dto.js'
import type { ProspectEntity } from './entities/prospect.entity.js'
import { ProspectRow, ProspectsRepository } from './prospects.repository.js'

export interface Board {
  data: ProspectEntity[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    byState: Array<{ code: string; total: number }>
  }
}

@Injectable()
export class ProspectsService {
  constructor(
    private readonly repo: ProspectsRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async create(dto: CreateProspectDto, user: AuthenticatedUser): Promise<ProspectEntity> {
    if (!(await this.repo.hotelExists(dto.hotelId))) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    const openCycle = await this.repo.openCycleOf(dto.hotelId)

    if (openCycle) {
      throw new ConflictException({
        code: 'PROSPECT_ALREADY_OPEN',
        message: 'Este hotel ya tiene un ciclo comercial abierto',
        details: [{ field: 'hotelId', value: openCycle.id }],
      })
    }

    const ownerUserId = dto.ownerUserId ?? user.id

    if (ownerUserId !== user.id && !(await this.repo.userExists(ownerUserId))) {
      throw new NotFoundException({
        code: 'OWNER_NOT_FOUND',
        message: 'El usuario dueño del ciclo no existe o está desactivado',
      })
    }

    return toEntity(
      await this.repo.create(dto.hotelId, ownerUserId, dto.needDescription ?? null, user.id),
    )
  }

  async list(query: QueryProspectsDto, user: AuthenticatedUser): Promise<Board> {
    const ownerUserId = await this.scope(query.ownerUserId, user)
    const filtro = { ...query, ownerUserId }

    const [{ rows, total }, byState] = await Promise.all([
      this.repo.findMany(filtro),
      this.repo.countByState({
        ...(filtro.includeClosed ? {} : { closedAt: null }),
        ...(ownerUserId ? { ownerUserId } : {}),
        ...(query.zoneId ? { hotel: { zoneId: query.zoneId } } : {}),
      }),
    ])

    return {
      data: rows.map(toEntity),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
        byState,
      },
    }
  }

  async get(id: string): Promise<ProspectEntity> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({ code: 'PROSPECT_NOT_FOUND', message: 'El prospecto no existe' })
    }

    return toEntity(row)
  }

  private async scope(
    requested: string | undefined,
    user: AuthenticatedUser,
  ): Promise<string | undefined> {
    const seesAll = await this.permissions.can(user.roleCode, 'pipeline', 'read_all')

    if (seesAll) {
      return requested
    }

    return user.id
  }
}

function toEntity(row: ProspectRow): ProspectEntity {
  return {
    id: row.id,
    hotel: row.hotel,
    owner: row.owner,
    state: {
      code: row.onboardingState.code,
      color: row.onboardingState.color,
      name: row.onboardingState.name,
      isBranch: row.onboardingState.isBranch,
      displayOrder: row.onboardingState.displayOrder,
    },
    stateSince: (row.history[0]?.occurredAt ?? row.openedAt).toISOString(),
    needDescription: row.needDescription,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    attemptCount: row._count.attempts,
    isOpen: row.closedAt === null,
  }
}
