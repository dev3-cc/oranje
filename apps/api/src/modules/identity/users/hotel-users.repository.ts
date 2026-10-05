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
  // El idioma de la persona (D-36): decide en que idioma le escribimos.
  locale: true,
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

  /**
   * Si el hotel cae en alguna zona del BD. Su alcance son las zonas y no un
   * hotel fijo (D-09), así que invitar se acota por ahí.
   */
  async hotelInUserZones(hotelId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.hotel.count({
      where: { id: hotelId, zone: { users: { some: { userId } } } },
    })

    return count > 0
  }

  /**
   * Si al hotel le queda un Manager General activo.
   *
   * Es lo que decide si el Manager de Área puede nombrar uno: con gerente
   * vivo el cambio lo hace él mismo, su BD o el Administrador; sin ninguno
   * —la rotación— el segundo de a bordo destraba el hotel sin llamar a nadie.
   */
  async hasActiveGeneralManager(hotelId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { hotelId, isActive: true, role: { code: 'ROL-H-03' } },
    })

    return count > 0
  }

  /**
   * El BD que lleva la cuenta comercial del hotel, para avisarle cuando el
   * propio hotel invita a alguien: ya no es él quien la da de alta, pero
   * sigue siendo quien responde por ese hotel.
   *
   * Sale del ciclo de onboarding ABIERTO; si el hotel no tiene ninguno
   * (cliente viejo, ciclo archivado) devuelve null y no se avisa a nadie.
   */
  async accountOwner(hotelId: string): Promise<string | null> {
    const prospect = await this.prisma.prospect.findFirst({
      where: { hotelId, closedAt: null },
      select: { ownerUserId: true },
      orderBy: { createdAt: 'desc' },
    })

    return prospect?.ownerUserId ?? null
  }

  /**
   * Deja la cuenta esperando aprobación. Se reusa `is_active` en vez de
   * inventar un estado: una cuenta inactiva ya es exactamente «no entra
   * todavía», y el resto del sistema ya lo respeta.
   */
  async deactivate(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { isActive: false } })
  }

  /** Las cuentas gerenciales que el hotel propuso y siguen esperando. */
  async pendingApprovals(): Promise<HotelUserRow[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        isActive: false,
        firebaseUid: null,
        role: { code: { in: ['ROL-H-02', 'ROL-H-03'] } },
        hotelId: { not: null },
      },
      select: SELECT,
      orderBy: { createdAt: 'desc' },
    })

    /* El `where` ya excluye las filas sin hotel; el filtro es para que el
       compilador lo sepa, no para tapar un caso que pueda ocurrir. */
    return rows.filter((row): row is HotelUserRow => row.hotel !== null)
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
  /** Activa la cuenta propuesta y deja el rastro de quién la aprobó. */
  async approve(id: string, actor: { userId: string; role: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: true } })

      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: id,
          eventType: 'HOTEL_USER_APPROVED',
          actorUserId: actor.userId,
          actorRole: actor.role,
          payload: {},
        },
      })
    })
  }

  /**
   * Quién la propuso, leyendo el journal: no se guarda en una columna
   * aparte, el rastro de `HOTEL_USER_CREATED` ya lo tiene.
   */
  async proposedBy(id: string): Promise<string | null> {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { entityType: 'identity.user', entityId: id, eventType: 'HOTEL_USER_CREATED' },
      select: { actorUserId: true },
      orderBy: { occurredAt: 'asc' },
    })

    return entry?.actorUserId ?? null
  }

  /**
   * Rechaza y borra la fila: una cuenta pendiente nunca llegó a existir de
   * verdad —sin acceso, sin invitación—, así que no hay nada que conservar
   * ahí; el rastro vive en el journal, que no se toca al borrar (`entityId`
   * es un vínculo polimórfico sin FK, igual que en cualquier otro borrado).
   */
  async reject(id: string, reason: string, actor: { userId: string; role: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.create({
        data: {
          id: uuidv7(),
          entityType: 'identity.user',
          entityId: id,
          eventType: 'HOTEL_USER_REJECTED',
          actorUserId: actor.userId,
          actorRole: actor.role,
          payload: { reason },
        },
      })

      await tx.user.delete({ where: { id } })
    })
  }

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
    /** Idioma de la persona (D-36): decide en qué idioma sale su invitación. */
    locale: string
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
          locale: params.locale,
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
