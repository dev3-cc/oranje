import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

import type { CreateHotelDto } from './dto/create-hotel.dto.js'
import type { QueryHotelsDto } from './dto/query-hotels.dto.js'
import type { UpdateHotelDto } from './dto/update-hotel.dto.js'

const SELECT = {
  id: true,
  name: true,
  generalPhone: true,
  timeZone: true,
  geofenceRadiusM: true,
  activatedAt: true,
  createdAt: true,
  updatedAt: true,
  zone: { select: { id: true, code: true, name: true } },
  _count: { select: { contacts: true } },
} as const

export type HotelRow = Prisma.HotelGetPayload<{ select: typeof SELECT }> & {
  latitude?: number | null
  longitude?: number | null
}

@Injectable()
export class HotelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: QueryHotelsDto): Promise<{ rows: HotelRow[]; total: number }> {
    const where: Prisma.HotelWhereInput = {
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
      ...(query.onlyClients ? { activatedAt: { not: null } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    }

    const [plain, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        select: SELECT,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.hotel.count({ where }),
    ])

    const coords = await this.coordinatesOf(plain.map((r) => r.id))
    const rows = plain.map((r) => ({ ...r, ...coords[r.id] }))

    return { rows, total }
  }

  async findById(id: string): Promise<HotelRow | null> {
    const row = await this.prisma.hotel.findUnique({ where: { id }, select: SELECT })

    return row ? { ...row, ...(await this.coordinatesOf([row.id]))[row.id] } : null
  }

  async coordinatesOf(
    ids: string[],
  ): Promise<Record<string, { latitude: number | null; longitude: number | null }>> {
    if (ids.length === 0) {
      return {}
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; latitude: number | null; longitude: number | null }>
    >`
      SELECT id,
             ST_Y(coordinates::geometry) AS latitude,
             ST_X(coordinates::geometry) AS longitude
        FROM commercial.hotel
       WHERE id = ANY(${Prisma.sql`ARRAY[${Prisma.join(ids.map((i) => Prisma.sql`${i}::uuid`))}]`})`

    return Object.fromEntries(
      rows.map((r) => [r.id, { latitude: r.latitude, longitude: r.longitude }]),
    )
  }

  async setCoordinates(id: string, latitude: number, longitude: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE commercial.hotel
         SET coordinates = ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)::geography
       WHERE id = ${id}::uuid`
  }

  async findByName(name: string): Promise<{ id: string } | null> {
    return this.prisma.hotel.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
  }

  async zoneExists(zoneId: string): Promise<boolean> {
    return (await this.prisma.zone.count({ where: { id: zoneId } })) > 0
  }

  async create(data: CreateHotelDto, userId: string): Promise<HotelRow> {
    return this.prisma.hotel.create({
      data: {
        id: uuidv7(),
        name: data.name,
        zoneId: data.zoneId,
        timeZone: data.timeZone,
        generalPhone: data.generalPhone ?? null,
        geofenceRadiusM: data.geofenceRadiusM ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
      select: SELECT,
    })
  }

  async update(id: string, data: UpdateHotelDto, userId: string): Promise<HotelRow> {
    return this.prisma.hotel.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.zoneId !== undefined ? { zoneId: data.zoneId } : {}),
        ...(data.timeZone !== undefined ? { timeZone: data.timeZone } : {}),
        ...(data.generalPhone !== undefined ? { generalPhone: data.generalPhone } : {}),
        ...(data.geofenceRadiusM !== undefined ? { geofenceRadiusM: data.geofenceRadiusM } : {}),
        updatedBy: userId,
      },
      select: SELECT,
    })
  }
}
