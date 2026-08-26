import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

const SELECT = {
  id: true,
  email: true,
  fullName: true,
  firebaseUid: true,
  reportsToUserId: true,
  isActive: true,
  createdAt: true,
  role: { select: { code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
} as const

export type HotelUserRow = {
  id: string
  email: string
  fullName: string
  firebaseUid: string | null
  reportsToUserId: string | null
  isActive: boolean
  createdAt: Date
  role: { code: string; name: string }
  department: { id: string; code: string; name: string } | null
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

  async userOfHotel(id: string, hotelId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({ where: { id, hotelId }, select: { id: true } })
  }

  async listAll(hotelId: string, includeInactive: boolean): Promise<HotelUserRow[]> {
    return this.prisma.user.findMany({
      where: { hotelId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ role: { code: 'desc' } }, { fullName: 'asc' }],
      select: SELECT,
    })
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

    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: SELECT })
  }
}
