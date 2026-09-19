import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

const SELECT = {
  id: true,
  hotelId: true,
  fullName: true,
  jobTitle: true,
  phone: true,
  email: true,
  isPrimary: true,
  isActive: true,
  createdAt: true,
  _count: { select: { attempts: true } },
} as const

export type ContactRow = Prisma.HotelContactGetPayload<{ select: typeof SELECT }>

export interface ContactFields {
  fullName?: string | undefined
  jobTitle?: string | null | undefined
  phone?: string | null | undefined
  email?: string | null | undefined
  isActive?: boolean | undefined
}

export interface NewContactFields extends ContactFields {
  fullName: string
}

@Injectable()
export class HotelContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByHotel(hotelId: string, includeInactive: boolean): Promise<ContactRow[]> {
    return this.prisma.hotelContact.findMany({
      where: { hotelId, ...(includeInactive ? {} : { isActive: true }) },
      select: SELECT,
      orderBy: [{ isPrimary: 'desc' }, { isActive: 'desc' }, { fullName: 'asc' }],
    })
  }

  async findOne(hotelId: string, id: string): Promise<ContactRow | null> {
    const row = await this.prisma.hotelContact.findUnique({ where: { id }, select: SELECT })

    return row?.hotelId === hotelId ? row : null
  }

  async hotelExists(hotelId: string): Promise<boolean> {
    return (await this.prisma.hotel.count({ where: { id: hotelId } })) > 0
  }

  async create(hotelId: string, fields: NewContactFields, primary: boolean): Promise<ContactRow> {
    const id = uuidv7()

    await this.prisma.$transaction(async (tx) => {
      if (primary) {
        await tx.hotelContact.updateMany({
          where: { hotelId, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      await tx.hotelContact.create({
        data: {
          id,
          hotelId,
          fullName: fields.fullName,
          jobTitle: fields.jobTitle ?? null,
          phone: fields.phone ?? null,
          email: fields.email ?? null,
          isPrimary: primary,
        },
      })
    })

    return this.prisma.hotelContact.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async update(
    hotelId: string,
    id: string,
    fields: ContactFields,
    primary: boolean | undefined,
  ): Promise<ContactRow> {
    await this.prisma.$transaction(async (tx) => {
      if (primary === true) {
        await tx.hotelContact.updateMany({
          where: { hotelId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        })
      }

      const data: Prisma.HotelContactUpdateInput = {}

      if (fields.fullName !== undefined) data.fullName = fields.fullName
      if (fields.jobTitle !== undefined) data.jobTitle = fields.jobTitle
      if (fields.phone !== undefined) data.phone = fields.phone
      if (fields.email !== undefined) data.email = fields.email
      if (fields.isActive !== undefined) data.isActive = fields.isActive
      if (primary !== undefined) data.isPrimary = primary

      await tx.hotelContact.update({ where: { id }, data })
    })

    return this.prisma.hotelContact.findUniqueOrThrow({ where: { id }, select: SELECT })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.hotelContact.delete({ where: { id } })
  }

  async hasActivePrimary(hotelId: string, exceptId: string): Promise<boolean> {
    return (
      (await this.prisma.hotelContact.count({
        where: { hotelId, isPrimary: true, isActive: true, id: { not: exceptId } },
      })) > 0
    )
  }
}
