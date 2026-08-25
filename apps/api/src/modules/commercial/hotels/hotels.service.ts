import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { PlacesService } from '../../../infra/places/index.js'

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
  constructor(
    private readonly repo: HotelsRepository,
    private readonly places: PlacesService,
  ) {}

  async list(query: QueryHotelsDto): Promise<Paginated<HotelEntity>> {
    const { rows, total } = await this.repo.findMany(query)

    return {
      data: rows.map((row) => this.toEntity(row)),
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

    return this.toEntity(row)
  }

  async create(dto: CreateHotelDto, userId: string): Promise<HotelEntity> {
    await this.assertZone(dto.zoneId)
    await this.assertNameAvailable(dto.name)

    const row = await this.repo.create(dto, userId)

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.repo.setCoordinates(row.id, dto.latitude, dto.longitude)
    }

    await this.resolvePhoto(row.id, dto.placeId ?? null, null)

    return this.get(row.id)
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

    if (dto.placeId !== undefined && dto.placeId !== current.placeId) {
      await this.resolvePhoto(id, dto.placeId, null)
    }

    return this.get(id)
  }

  // Se resuelve al ESCRIBIR, no en cada lectura: una lista de veinte hoteles
  // serían veinte llamadas facturables a Places.
  //
  // Y se refresca cuando la referencia pasa de 30 días, que es lo que la
  // política de Google permite guardar de todo lo que no sea el place_id.
  private async resolvePhoto(
    id: string,
    placeId: string | null,
    resolvedAt: Date | null,
  ): Promise<void> {
    if (!placeId || !this.places.enabled || !this.places.isStale(resolvedAt)) {
      return
    }

    await this.repo.setPhotoRef(id, await this.places.photoRef(placeId))
  }

  private toEntity(row: HotelRow): HotelEntity {
    return { ...toEntity(row), photoUrl: this.places.mediaUrl(row.photoRef) }
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
    photoUrl: null,
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
