import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { v7 as uuidv7 } from 'uuid'

import { PrismaService } from '../../infra/prisma/index.js'

import type { NotificationEvent } from './dto/event.dto.js'
import type { QueryNotificationsDto, RegisterDeviceDto } from './dto/notifications.dto.js'
import { PushService } from './push.service.js'
import { RecipientsService } from './recipients.service.js'

export interface NotificationEntity {
  id: string
  type: { code: string; name: string; module: string }
  title: string
  body: string
  entity: { type: string; id: string } | null
  createdAt: string
  readAt: string | null
}

export interface NotificationBoard {
  data: NotificationEntity[]
  meta: { page: number; limit: number; total: number; totalPages: number; unread: number }
}

export interface FanOutResult {
  type: string
  recipients: number
  created: number
  duplicates: number
  pushed: number
}

const SELECT = {
  id: true,
  title: true,
  body: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  readAt: true,
  type: { select: { code: true, name: true, module: true } },
} as const

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipients: RecipientsService,
    private readonly push: PushService,
  ) {}

  // El fan-out: una fila POR DESTINATARIO. Un evento con dos personas son dos
  // filas, porque cada quien la lee en su momento.
  async fanOut(event: NotificationEvent): Promise<FanOutResult> {
    const type = await this.prisma.notificationType.findUnique({
      where: { code: event.type },
      select: { id: true, isActive: true },
    })

    if (!type) {
      throw new NotFoundException({
        code: 'NOTIFICATION_TYPE_UNKNOWN',
        message: `El tipo ${event.type} no está en el catálogo`,
      })
    }

    const userIds = type.isActive ? await this.recipients.resolve(event.audience) : []
    const result: FanOutResult = {
      type: event.type,
      recipients: userIds.length,
      created: 0,
      duplicates: 0,
      pushed: 0,
    }

    for (const userId of userIds) {
      const id = await this.insert(userId, type.id, event)

      if (id === null) {
        // El unico parcial lo rechazo: es el mismo evento otra vez, no un aviso
        // nuevo. Pub/Sub entrega al menos una vez y esto es lo que lo absorbe.
        result.duplicates += 1
        continue
      }

      result.created += 1

      const sent = await this.push.send(userId, event)

      await this.prisma.notification.update({
        where: { id },
        data: { pushedAt: new Date(), pushError: sent.error },
      })

      if (sent.sent > 0) {
        result.pushed += 1
      }
    }

    return result
  }

  async list(userId: string, query: QueryNotificationsDto): Promise<NotificationBoard> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    }

    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ])

    return {
      data: rows.map(toEntity),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
        unread,
      },
    }
  }

  // El badge de RF-C-09. Se consulta en cada apertura de la app, y por eso el
  // indice de no leidas es parcial.
  async unreadCount(userId: string): Promise<{ unread: number }> {
    return { unread: await this.prisma.notification.count({ where: { userId, readAt: null } }) }
  }

  async markRead(userId: string, id: string): Promise<NotificationEntity> {
    const row = await this.prisma.notification.findFirst({ where: { id, userId }, select: SELECT })

    if (!row) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'La notificación no existe o no es tuya',
      })
    }

    // Marcarla dos veces no mueve la fecha: la primera es la que cuenta.
    if (row.readAt !== null) {
      return toEntity(row)
    }

    return toEntity(
      await this.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
        select: SELECT,
      }),
    )
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })

    return { updated: count }
  }

  // El token de FCM rota, asi que registrar es tanto alta como renovacion: si
  // el token ya existia para otra persona se le quita, porque en un telefono
  // prestado esa es justo la forma de recibir los push de alguien mas.
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<{ id: string; platform: string }> {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      await tx.device.updateMany({
        where: { fcmToken: dto.fcmToken, revokedAt: null, NOT: { userId } },
        data: { revokedAt: now },
      })

      const mine = await tx.device.findFirst({
        where: { userId, fcmToken: dto.fcmToken, revokedAt: null },
        select: { id: true },
      })

      if (mine) {
        await tx.device.update({
          where: { id: mine.id },
          data: { lastSeenAt: now, platform: dto.platform },
        })

        return { id: mine.id, platform: dto.platform }
      }

      const created = await tx.device.create({
        data: {
          id: uuidv7(),
          userId,
          fcmToken: dto.fcmToken,
          platform: dto.platform,
          lastSeenAt: now,
        },
        select: { id: true, platform: true },
      })

      return created
    })
  }

  // No se borra: queda el rastro de desde donde entro esa persona.
  async revokeDevice(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.device.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    if (count === 0) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'El dispositivo no existe, no es tuyo o ya estaba revocado',
      })
    }
  }

  // El unico parcial es quien decide, no un SELECT previo: entre el SELECT y el
  // INSERT cabe el reintento de Pub/Sub.
  private async insert(
    userId: string,
    typeId: string,
    event: NotificationEvent,
  ): Promise<string | null> {
    const id = uuidv7()

    try {
      await this.prisma.notification.create({
        data: {
          id,
          userId,
          notificationTypeId: typeId,
          title: event.title,
          body: event.body,
          entityType: event.entity?.type ?? null,
          entityId: event.entity?.id ?? null,
        },
      })

      return id
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null
      }

      throw error
    }
  }
}

function toEntity(row: {
  id: string
  title: string
  body: string
  entityType: string | null
  entityId: string | null
  createdAt: Date
  readAt: Date | null
  type: { code: string; name: string; module: string }
}): NotificationEntity {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    entity: row.entityType && row.entityId ? { type: row.entityType, id: row.entityId } : null,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }
}
