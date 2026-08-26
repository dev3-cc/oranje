import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

import type { QueryStaffUsersDto } from './dto/query-staff-users.dto.js'

const SELECT = {
  id: true,
  email: true,
  fullName: true,
  firebaseUid: true,
  reportsToUserId: true,
  photoPath: true,
  isActive: true,
  createdAt: true,
  role: { select: { code: true, name: true } },
} as const

export type StaffUserRow = Prisma.UserGetPayload<{ select: typeof SELECT }>

@Injectable()
export class StaffUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: QueryStaffUsersDto): Promise<{ rows: StaffUserRow[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      /** Personal del sistema = sin hotel. Los del hotel viven en su endpoint. */
      hotelId: null,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.roleCode ? { role: { code: query.roleCode } } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SELECT,
        orderBy: [{ role: { code: 'asc' } }, { fullName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ])

    return { rows, total }
  }

  async findById(id: string): Promise<StaffUserRow | null> {
    return this.prisma.user.findFirst({ where: { id, hotelId: null }, select: SELECT })
  }

  async roleByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.role.findUnique({ where: { code }, select: { id: true } })
  }

  async emailTaken(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0
  }

  async activeUser(id: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({ where: { id, isActive: true }, select: { id: true } })
  }

  async create(params: {
    email: string
    fullName: string
    roleId: string
    roleCode: string
    reportsToUserId: string | null
    photoPath: string | null
    /** Cómo nace el acceso. La contraseña en sí JAMÁS llega aquí. */
    credentialOrigin: 'invitation' | 'password'
    actorUserId: string
    actorRole: string
  }): Promise<StaffUserRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          email: params.email,
          fullName: params.fullName,
          roleId: params.roleId,
          reportsToUserId: params.reportsToUserId,
          photoPath: params.photoPath,
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: id,
          eventType: 'STAFF_USER_CREATED',
          actorUserId: params.actorUserId,
          actorRole: params.actorRole,
          payload: {
            email: params.email,
            roleCode: params.roleCode,
            credentialOrigin: params.credentialOrigin,
          },
        },
      })
    })

    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async update(
    id: string,
    data: {
      fullName?: string
      roleId?: string
      reportsToUserId?: string | null
      photoPath?: string | null
      isActive?: boolean
    },
    actor: { userId: string; role: string },
    payload: Prisma.InputJsonValue,
  ): Promise<StaffUserRow> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.roleId !== undefined ? { roleId: data.roleId } : {}),
          ...(data.reportsToUserId !== undefined ? { reportsToUserId: data.reportsToUserId } : {}),
          ...(data.photoPath !== undefined ? { photoPath: data.photoPath } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
      })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: id,
          eventType: 'STAFF_USER_UPDATED',
          actorUserId: actor.userId,
          actorRole: actor.role,
          payload,
        },
      })
    })

    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: SELECT })
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
