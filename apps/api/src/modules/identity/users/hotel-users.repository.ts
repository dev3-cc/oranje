import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

import { HOTEL_ROLES } from './dto/create-hotel-user.dto.js'
import type { QueryHotelUsersDto } from './dto/query-hotel-users.dto.js'

const SELECT = {
  id: true,
  email: true,
  fullName: true,
  firebaseUid: true,
  reportsToUserId: true,
  isActive: true,
  createdAt: true,
  role: { select: { code: true, name: true } },
  hotel: { select: { id: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
} as const

export type HotelUserRow = Omit<Prisma.UserGetPayload<{ select: typeof SELECT }>, 'hotel'> & {
  hotel: { id: string; name: string }
}

/** Lo que hace falta de un jefe para validar «Reporta a». */
export interface HotelBossRow {
  id: string
  roleCode: string
  departmentId: string | null
}

@Injectable()
export class HotelUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotelExists(hotelId: string): Promise<boolean> {
    return (await this.prisma.hotel.count({ where: { id: hotelId } })) > 0
  }

  async roleByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.role.findUnique({ where: { code }, select: { id: true } })
  }

  async departmentExists(id: string): Promise<boolean> {
    return (await this.prisma.hotelDepartment.count({ where: { id } })) > 0
  }

  async emailTaken(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0
  }

  async bossOfHotel(id: string, hotelId: string): Promise<HotelBossRow | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, hotelId, isActive: true },
      select: { id: true, departmentId: true, role: { select: { code: true } } },
    })

    return row ? { id: row.id, roleCode: row.role.code, departmentId: row.departmentId } : null
  }

  /** Una cuenta del hotel: con hotel. El personal del sistema no entra por aquí. */
  async findById(id: string): Promise<HotelUserRow | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, hotelId: { not: null } },
      select: SELECT,
    })

    return row as HotelUserRow | null
  }

  async listAll(hotelId: string, includeInactive: boolean): Promise<HotelUserRow[]> {
    const rows = await this.prisma.user.findMany({
      where: { hotelId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ role: { code: 'desc' } }, { fullName: 'asc' }],
      select: SELECT,
    })

    return rows as HotelUserRow[]
  }

  /** El directorio del Administrador: todos los hoteles, paginado. */
  async findMany(query: QueryHotelUsersDto): Promise<{ rows: HotelUserRow[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      hotelId: query.hotelId ?? { not: null },
      role: { code: query.roleCode ?? { in: [...HOTEL_ROLES] } },
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { hotel: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SELECT,
        orderBy: [{ hotel: { name: 'asc' } }, { role: { code: 'desc' } }, { fullName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ])

    return { rows: rows as HotelUserRow[], total }
  }

  async create(params: {
    hotelId: string
    email: string
    fullName: string
    roleId: string
    roleCode: string
    departmentId: string | null
    reportsToUserId: string | null
    actorUserId: string
    actorRole: string
  }): Promise<HotelUserRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          email: params.email,
          fullName: params.fullName,
          roleId: params.roleId,
          hotelId: params.hotelId,
          departmentId: params.departmentId,
          reportsToUserId: params.reportsToUserId,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: id,
          eventType: 'HOTEL_USER_CREATED',
          actorUserId: params.actorUserId,
          actorRole: params.actorRole,
          payload: {
            hotelId: params.hotelId,
            email: params.email,
            roleCode: params.roleCode,
          },
        },
      })
    })

    return (await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: SELECT,
    })) as HotelUserRow
  }

  async update(
    id: string,
    data: {
      fullName?: string
      departmentId?: string | null
      reportsToUserId?: string | null
      isActive?: boolean
    },
    actor: { userId: string; role: string },
    payload: Prisma.InputJsonValue,
  ): Promise<HotelUserRow> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
          ...(data.reportsToUserId !== undefined ? { reportsToUserId: data.reportsToUserId } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: id,
          eventType: 'HOTEL_USER_UPDATED',
          actorUserId: actor.userId,
          actorRole: actor.role,
          payload,
        },
      })
    })

    return (await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: SELECT,
    })) as HotelUserRow
  }

  /** El destino de la invitación (enviada, fallida, reenviada) va al journal. */
  async journal(
    userId: string,
    eventType: string,
    actor: { userId: string; role: string },
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.journalEntry.create({
      data: {
        id: uuidv7(),
        entityType: 'identity.user',
        entityId: userId,
        eventType,
        actorUserId: actor.userId,
        actorRole: actor.role,
        payload,
      },
    })
  }
}
