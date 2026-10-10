import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../infra/prisma/index.js'

export interface RoleEntity {
  code: string
  name: string
  department: string | null
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Los roles que el Administrador puede dar de alta por `POST /users`.
   * Se excluyen los que tienen otro camino de nacimiento: ROL-H-* sale de la
   * Conversión (RR-V-02) y ROL-C-01 del alta de colaboradores.
   */
  async internal(): Promise<RoleEntity[]> {
    return this.prisma.role.findMany({
      where: {
        /* El Sistema tampoco: no es una persona, y ofrecerlo en el alta sería
           invitar a que alguien firme como el sistema (Hugo, 2026-10-10). */
        AND: [
          { code: { not: { startsWith: 'ROL-H-' } } },
          { code: { not: 'ROL-C-01' } },
          { code: { not: 'ROL-SYS-01' } },
        ],
      },
      select: { code: true, name: true, department: true },
      orderBy: { code: 'asc' },
    })
  }
}
