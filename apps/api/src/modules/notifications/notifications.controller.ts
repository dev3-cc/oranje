import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common'

import { CurrentUser, Requires } from '../../common/decorators/index.js'
import type { AuthenticatedUser } from '../../common/decorators/index.js'

import { QueryNotificationsDto, RegisterDeviceDto } from './dto/notifications.dto.js'
import { NotificationsService } from './notifications.service.js'
import type { NotificationBoard, NotificationEntity } from './notifications.service.js'

// Todo es _own y no lleva `id` de usuario en la ruta: nadie ve las
// notificaciones de nadie. El alcance sale del token, no del cliente.
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Requires('system', 'receive_notification')
  @Get('notifications')
  list(
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationBoard> {
    return this.notifications.list(user.id, query)
  }

  @Requires('system', 'receive_notification')
  @Get('notifications/unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<{ unread: number }> {
    return this.notifications.unreadCount(user.id)
  }

  @Requires('system', 'receive_notification')
  @Post('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: NotificationEntity }> {
    return { data: await this.notifications.markRead(user.id, id) }
  }

  @Requires('system', 'receive_notification')
  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ updated: number }> {
    return this.notifications.markAllRead(user.id)
  }

  @Requires('system', 'receive_notification')
  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  async registerDevice(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { id: string; platform: string } }> {
    return { data: await this.notifications.registerDevice(user.id, dto) }
  }

  @Requires('system', 'receive_notification')
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.notifications.revokeDevice(user.id, id)
  }
}
