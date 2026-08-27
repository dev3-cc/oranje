import { Injectable, UnauthorizedException } from '@nestjs/common'

import type { AuthenticatedUser } from '../../../common/decorators/index.js'
import { PrismaService } from '../../../infra/prisma/index.js'
import { StorageService } from '../../../infra/storage/index.js'

export interface MeEntity {
  id: string
  email: string
  fullName: string
  role: { code: string; name: string; department: string | null }
  /** URL firmada de la foto (D-30); `null` sin foto o si el firmado falla. */
  photoUrl: string | null
  hotel: { id: string; name: string } | null
  department: { id: string; code: string; name: string } | null
  zones: Array<{ id: string; code: string; name: string }>
  permissions: string[]
}

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async get(user: AuthenticatedUser): Promise<MeEntity> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        photoPath: true,
        role: { select: { id: true, code: true, name: true, department: true } },
        hotel: { select: { id: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        zones: { select: { zone: { select: { id: true, code: true, name: true } } } },
      },
    })

    if (!row) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'El usuario del token ya no existe',
      })
    }

    const permissions = await this.prisma.rolePermission.findMany({
      where: { roleId: row.role.id },
      select: { module: true, action: true },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    })

    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      photoUrl: row.photoPath ? await this.storage.signedUrl(row.photoPath) : null,
      role: { code: row.role.code, name: row.role.name, department: row.role.department },
      hotel: row.hotel,
      department: row.department,
      zones: row.zones.map((z) => z.zone),
      permissions: permissions.map((p) => `${p.module}.${p.action}`),
    }
  }
}
