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

export type HotelRow = Prisma.HotelGetPayload<{ select: typeof SELECT }>

@Injectable()
export class HotelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: QueryHotelsDto): Promise<{ rows: HotelRow[]; total: number }> {
    const where: Prisma.HotelWhereInput = {
      ...(query.zoneId ? { zoneId: query.zoneId } : {}),
      ...(query.onlyClients ? { activatedAt: { not: null } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.hotel.findMany({
        where,
        select: SELECT,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.hotel.count({ where }),
    ])

    return { rows, total }
  }

  async findById(id: string): Promise<HotelRow | null> {
    return this.prisma.hotel.findUnique({ where: { id }, select: SELECT })
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
