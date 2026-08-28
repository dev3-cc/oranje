import { Injectable } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { StorageService } from '../../../infra/storage/index.js'

export interface MemberEntity {
  id: string
  fullName: string
  email: string
  role: { code: string; name: string }
  /** URL firmada de la foto (D-30); `null` sin foto o si el firmado falla. */
  photoUrl: string | null
  zones: Array<{ id: string; code: string; name: string }>
  openProspects: number
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async members(actor: AuthenticatedUser): Promise<MemberEntity[]> {
    const rows = await this.prisma.user.findMany({
      where: { reportsToUserId: actor.id, isActive: true },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        photoPath: true,
        role: { select: { code: true, name: true } },
        zones: { select: { zone: { select: { id: true, code: true, name: true } } } },
        _count: { select: { prospectsOwned: { where: { closedAt: null } } } },
      },
    })

    // Una firma por ruta distinta: la misma foto en dos filas se firma una vez.
    const paths = [...new Set(rows.flatMap((r) => (r.photoPath ? [r.photoPath] : [])))]
    const urls = await Promise.all(paths.map((path) => this.storage.signedUrl(path)))
    const photos = new Map(paths.map((path, index) => [path, urls[index] ?? null]))

    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      role: r.role,
      photoUrl: r.photoPath ? (photos.get(r.photoPath) ?? null) : null,
      zones: r.zones.map((z) => z.zone),
      openProspects: r._count.prospectsOwned,
    }))
  }
}
