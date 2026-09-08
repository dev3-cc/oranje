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
  address: true,
  placeId: true,
  photoRef: true,
  photoRefAt: true,
  timeZone: true,
  geofenceRadiusM: true,
  activatedAt: true,
  punchMethod: true,
  punchQrVersion: true,
  punchQrGeneratedAt: true,
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
        address: data.address ?? null,
        placeId: data.placeId ?? null,
        geofenceRadiusM: data.geofenceRadiusM ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
      select: SELECT,
    })
  }

  // La foto la resuelve el servidor contra Places, no la manda el cliente.
  async setPhotoRef(id: string, photoRef: string | null): Promise<void> {
    await this.prisma.hotel.update({
      where: { id },
      data: { photoRef, photoRefAt: new Date() },
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
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.placeId !== undefined ? { placeId: data.placeId } : {}),
        ...(data.geofenceRadiusM !== undefined ? { geofenceRadiusM: data.geofenceRadiusM } : {}),
        ...(data.punchMethod !== undefined ? { punchMethod: data.punchMethod } : {}),
        updatedBy: userId,
      },
      select: SELECT,
    })
  }

  // El secreto se lee SOLO aquí: para imprimir el QR y para validarlo. Nunca
  // entra al SELECT general ni a la entidad.
  async punchQrOf(id: string): Promise<{
    name: string
    punchMethod: string
    secret: string | null
    version: number
    generatedAt: Date | null
  } | null> {
    const row = await this.prisma.hotel.findUnique({
      where: { id },
      select: {
        name: true,
        punchMethod: true,
        punchQrSecret: true,
        punchQrVersion: true,
        punchQrGeneratedAt: true,
      },
    })
    return row
      ? {
          name: row.name,
          punchMethod: row.punchMethod,
          secret: row.punchQrSecret,
          version: row.punchQrVersion,
          generatedAt: row.punchQrGeneratedAt,
        }
      : null
  }

  // Regenerar es un solo hecho: secreto nuevo, versión +1 y fecha. El anterior
  // deja de valer en cuanto esto confirma.
  async rotatePunchQr(
    id: string,
    secret: string,
    userId: string,
  ): Promise<{ version: number; generatedAt: Date }> {
    const row = await this.prisma.hotel.update({
      where: { id },
      data: {
        punchQrSecret: secret,
        punchQrVersion: { increment: 1 },
        punchQrGeneratedAt: new Date(),
        updatedBy: userId,
      },
      select: { punchQrVersion: true, punchQrGeneratedAt: true },
    })
    return { version: row.punchQrVersion, generatedAt: row.punchQrGeneratedAt ?? new Date() }
  }
}
