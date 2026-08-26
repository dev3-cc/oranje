import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PermissionsService } from '../../identity/index.js'

import type { SetZonesDto } from './dto/territory.dto.js'
import { TerritoriesRepository, ZoneRow } from './territories.repository.js'

const TERRITORY_ROLES = ['ROL-V-01', 'ROL-V-02']

export interface ZoneEntity {
  id: string
  code: string
  name: string
  hotelCount: number
  assignedAt: string
}

export interface TerritoryEntity {
  user: { id: string; fullName: string; roleCode: string }
  zones: ZoneEntity[]
}

@Injectable()
export class TerritoriesService {
  constructor(
    private readonly repo: TerritoriesRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async get(userId: string, actor: AuthenticatedUser): Promise<TerritoryEntity> {
    const isSelf = actor.id === userId
    // Quien asigna tambien lee: el Administrador no administra un equipo, pero
    // no puede repartir territorio a ciegas.
    const allowed = isSelf
      ? await this.permissions.can(actor.roleCode, 'territory', 'read')
      : (await this.permissions.can(actor.roleCode, 'team', 'read_members')) ||
        (await this.permissions.can(actor.roleCode, 'territory', 'assign'))

    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: isSelf
          ? 'Tu rol no tiene territorio propio'
          : 'Ver el territorio de otra persona requiere administrar el equipo',
      })
    }

    return this.read(userId)
  }

  private async read(userId: string): Promise<TerritoryEntity> {
    const user = await this.user(userId)

    return { user, zones: (await this.repo.of(userId)).map(toEntity) }
  }

  async set(userId: string, dto: SetZonesDto, actor: AuthenticatedUser): Promise<TerritoryEntity> {
    const user = await this.user(userId)

    if (!TERRITORY_ROLES.includes(user.roleCode)) {
      throw new UnprocessableEntityException({
        code: 'ROLE_WITHOUT_TERRITORY',
        message: `${user.fullName} es ${user.roleCode}: el territorio es de Ventas`,
      })
    }

    const unique = [...new Set(dto.zoneIds)]

    if (unique.length !== dto.zoneIds.length) {
      throw new UnprocessableEntityException({
        code: 'ZONE_DUPLICATED',
        message: 'Hay una zona repetida en la lista',
      })
    }

    const found = await this.repo.zonesExist(unique)
    const missing = unique.find((id) => !found.has(id))

    if (missing) {
      throw new NotFoundException({
        code: 'ZONE_NOT_FOUND',
        message: 'Una de las zonas no existe',
        details: [{ field: 'zoneIds', value: missing }],
      })
    }

    await this.repo.set({
      userId,
      zoneIds: unique,
      actorId: actor.id,
      roleCode: actor.roleCode,
    })

    // Quien acaba de asignar puede ver lo que asignó: volver por get() lo
    // obligaría además a `team:read_members`, que el Administrador no tiene.
    return this.read(userId)
  }

  async holders(zoneId: string): Promise<Array<{ id: string; fullName: string }>> {
    return this.repo.holdersOf(zoneId)
  }

  private async user(id: string): Promise<{ id: string; fullName: string; roleCode: string }> {
    const row = await this.repo.user(id)

    if (!row) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'El usuario no existe o está desactivado',
      })
    }

    return row
  }
}

function toEntity(row: ZoneRow): ZoneEntity {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    hotelCount: row.hotelCount,
    assignedAt: row.assignedAt.toISOString(),
  }
}
