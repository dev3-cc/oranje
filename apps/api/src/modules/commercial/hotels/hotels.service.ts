import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { CreateHotelDto } from './dto/create-hotel.dto.js'
import type { QueryHotelsDto } from './dto/query-hotels.dto.js'
import type { UpdateHotelDto } from './dto/update-hotel.dto.js'
import type { HotelEntity } from './entities/hotel.entity.js'
import { HotelRow, HotelsRepository } from './hotels.repository.js'

export interface Paginado<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

@Injectable()
export class HotelsService {
  constructor(private readonly repo: HotelsRepository) {}

  async list(query: QueryHotelsDto): Promise<Paginado<HotelEntity>> {
    const { rows, total } = await this.repo.findMany(query)

    return {
      data: rows.map(toEntity),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    }
  }

  async get(id: string): Promise<HotelEntity> {
    const row = await this.repo.findById(id)

    if (!row) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    return toEntity(row)
  }

  async create(dto: CreateHotelDto, userId: string): Promise<HotelEntity> {
    await this.assertZona(dto.zoneId)
    await this.assertNombreLibre(dto.name)

    return toEntity(await this.repo.create(dto, userId))
  }

  async update(id: string, dto: UpdateHotelDto, userId: string): Promise<HotelEntity> {
    const actual = await this.repo.findById(id)

    if (!actual) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    if (dto.zoneId !== undefined) {
      await this.assertZona(dto.zoneId)
    }

    if (dto.name !== undefined && dto.name.toLowerCase() !== actual.name.toLowerCase()) {
      await this.assertNombreLibre(dto.name)
    }

    return toEntity(await this.repo.update(id, dto, userId))
  }

  private async assertZona(zoneId: string): Promise<void> {
    if (!(await this.repo.zoneExists(zoneId))) {
      throw new NotFoundException({ code: 'ZONE_NOT_FOUND', message: 'La zona no existe' })
    }
  }

  private async assertNombreLibre(name: string): Promise<void> {
    if (await this.repo.findByName(name)) {
      throw new ConflictException({
        code: 'HOTEL_NAME_TAKEN',
        message: `Ya existe un hotel llamado ${name}`,
      })
    }
  }
}

function toEntity(row: HotelRow): HotelEntity {
  return {
    id: row.id,
    name: row.name,
    generalPhone: row.generalPhone,
    timeZone: row.timeZone,
    geofenceRadiusM: row.geofenceRadiusM,
    zone: row.zone,
    isClient: row.activatedAt !== null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    contactCount: row._count.contacts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}
