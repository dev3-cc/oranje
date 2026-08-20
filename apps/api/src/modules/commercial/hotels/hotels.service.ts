import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import type { CreateHotelDto } from './dto/create-hotel.dto.js'
import type { QueryHotelsDto } from './dto/query-hotels.dto.js'
import type { UpdateHotelDto } from './dto/update-hotel.dto.js'
import type { HotelEntity } from './entities/hotel.entity.js'
import { HotelRow, HotelsRepository } from './hotels.repository.js'

export interface Paginated<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

@Injectable()
export class HotelsService {
  constructor(private readonly repo: HotelsRepository) {}

  async list(query: QueryHotelsDto): Promise<Paginated<HotelEntity>> {
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
    await this.assertZone(dto.zoneId)
    await this.assertNameAvailable(dto.name)

    const row = await this.repo.create(dto, userId)

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.repo.setCoordinates(row.id, dto.latitude, dto.longitude)

      return this.get(row.id)
    }

    return toEntity(row)
  }

  async update(id: string, dto: UpdateHotelDto, userId: string): Promise<HotelEntity> {
    const current = await this.repo.findById(id)

    if (!current) {
      throw new NotFoundException({ code: 'HOTEL_NOT_FOUND', message: 'El hotel no existe' })
    }

    if (dto.zoneId !== undefined) {
      await this.assertZone(dto.zoneId)
    }

    if (dto.name !== undefined && dto.name.toLowerCase() !== current.name.toLowerCase()) {
      await this.assertNameAvailable(dto.name)
    }

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.repo.setCoordinates(id, dto.latitude, dto.longitude)
    }

    await this.repo.update(id, dto, userId)

    return this.get(id)
  }

  private async assertZone(zoneId: string): Promise<void> {
    if (!(await this.repo.zoneExists(zoneId))) {
      throw new NotFoundException({ code: 'ZONE_NOT_FOUND', message: 'La zona no existe' })
    }
  }

  private async assertNameAvailable(name: string): Promise<void> {
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
    address: row.address,
    placeId: row.placeId,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    zone: row.zone,
    isClient: row.activatedAt !== null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    contactCount: row._count.contacts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}
