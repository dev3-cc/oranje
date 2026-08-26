import { Injectable } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'

export interface MemberEntity {
  id: string
  fullName: string
  email: string
  role: { code: string; name: string }
  zones: Array<{ id: string; code: string; name: string }>
  openProspects: number
}

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async members(actor: AuthenticatedUser): Promise<MemberEntity[]> {
    const rows = await this.prisma.user.findMany({
      where: { reportsToUserId: actor.id, isActive: true },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: { select: { code: true, name: true } },
        zones: { select: { zone: { select: { id: true, code: true, name: true } } } },
        _count: { select: { prospectsOwned: { where: { closedAt: null } } } },
      },
    })

    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      role: r.role,
      zones: r.zones.map((z) => z.zone),
      openProspects: r._count.prospectsOwned,
    }))
  }
}
