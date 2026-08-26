import { Injectable } from '@nestjs/common'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface ZoneRow {
  id: string
  code: string
  name: string
  assignedAt: Date
  hotelCount: number
}

@Injectable()
export class TerritoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async user(id: string): Promise<{ id: string; fullName: string; roleCode: string } | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, isActive: true, role: { select: { code: true } } },
    })

    return row?.isActive === true
      ? { id: row.id, fullName: row.fullName, roleCode: row.role.code }
      : null
  }

  async zonesExist(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.zone.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })

    return new Set(rows.map((r) => r.id))
  }

  async of(userId: string): Promise<ZoneRow[]> {
    return this.prisma.$queryRaw<ZoneRow[]>`
      SELECT z.id,
             z.code,
             z.name,
             uz.assigned_at AS "assignedAt",
             (SELECT count(*)::int FROM commercial.hotel h WHERE h.zone_id = z.id) AS "hotelCount"
        FROM commercial.user_zone uz
        JOIN catalogs.zone z ON z.id = uz.zone_id
       WHERE uz.user_id = ${userId}::uuid
       ORDER BY z.name`
  }

  async set(params: {
    userId: string
    zoneIds: string[]
    actorId: string
    roleCode: string
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userZone.deleteMany({ where: { userId: params.userId } })

      if (params.zoneIds.length > 0) {
        await tx.userZone.createMany({
          data: params.zoneIds.map((zoneId) => ({ userId: params.userId, zoneId })),
        })
      }

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: params.userId,
          eventType: 'TERRITORY_ASSIGNED',
          actorUserId: params.actorId,
          actorRole: params.roleCode,
          payload: { zoneIds: params.zoneIds },
        },
      })
    })
  }

  async holdersOf(zoneId: string): Promise<Array<{ id: string; fullName: string }>> {
    return this.prisma.$queryRaw`
      SELECT u.id, u.full_name AS "fullName"
        FROM commercial.user_zone uz
        JOIN identity."user" u ON u.id = uz.user_id
       WHERE uz.zone_id = ${zoneId}::uuid AND u.is_active
       ORDER BY u.full_name`
  }
}
